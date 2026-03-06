import { Request, Response, NextFunction } from "express";
import { JobFetcherService } from "./job.services";
import { FetchJobsParams, Job, JobsResponse } from "./job.type";
import { pruneJob } from "../../utils/pruneJob";
import { AppError } from "../../utils/AppError";

const fetcher = new JobFetcherService();

// ─── Location filter ─────────────────────────────────────────────────────────

/**
 * Soft-filter: keep a job when its location field overlaps with the requested
 * location, when the job has no location info (can't tell), or when it is
 * marked remote.  This removes results that are clearly in the wrong region
 * without being too aggressive.
 */
function filterByLocation(jobs: Job[], location?: string): Job[] {
  if (!location) return jobs;
  const parts = location
    .toLowerCase()
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  return jobs.filter((job) => {
    if (job.is_remote || job.remote) return true;
    const jobLoc = (job.location ?? "").toLowerCase();
    if (!jobLoc) return true; // no location info — keep it
    return parts.some((part) => jobLoc.includes(part));
  });
}

// ─── Deduplication ────────────────────────────────────────────────────────────

function deduplicateByUrl(jobs: Job[]): Job[] {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const key = job.job_url ?? job.url ?? job.id;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export const getJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { keywords, location, query } = req.body as FetchJobsParams;

    // ── Validation ────────────────────────────────────────────────────────────
    const hasKeywords = Array.isArray(keywords) && keywords.length > 0;
    const hasQuery = typeof query === "string" && query.trim().length > 0;

    if (!hasKeywords && !hasQuery) {
      res.status(400).json({ message: "Keywords or query are required to fetch jobs." });
      return;
    }

    // ── Parallel scrape ───────────────────────────────────────────────────────
    const [rawLinkedInIndeed, rawGoogle] = await Promise.all([hasKeywords ? fetcher.fetchLinkedInIndeed(keywords!, location) : Promise.resolve([]), hasQuery ? fetcher.fetchGoogle(query!, location) : Promise.resolve([])]);

    if (rawLinkedInIndeed.length === 0 && rawGoogle.length === 0) {
      throw new AppError("Failed to fetch jobs: all sources returned empty results", 500);
    }

    // ── Prune + normalise ─────────────────────────────────────────────────────
    const googleJobs: Job[] = rawGoogle.map(pruneJob);
    const liJobs: Job[] = rawLinkedInIndeed.map(pruneJob);

    // ── Deduplicate (Google first, then LinkedIn/Indeed) ──────────────────────
    const deduped = deduplicateByUrl([...googleJobs, ...liJobs]);

    // ── Location filter ───────────────────────────────────────────────────────
    const jobs = filterByLocation(deduped, location);

    // ── Build response ────────────────────────────────────────────────────────
    const payload: JobsResponse = {
      message: "Jobs fetched successfully",
      total_jobs: jobs.length,
      jobs,
    };


    res.setHeader("X-Cache", "MISS");
    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
};
