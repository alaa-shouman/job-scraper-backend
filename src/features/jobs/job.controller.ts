import { Request, Response, NextFunction } from "express";
import { JobFetcherService } from "./jobFetcher.services";
import { FetchJobsParams, Job, JobsResponse } from "./job.type";
import { pruneJob } from "../../utils/pruneJob";
import { buildCacheKey, jobsCache } from "../../lib/cache";
import { AppError } from "../../utils/AppError";

const fetcher = new JobFetcherService();

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

    // ── Cache check ───────────────────────────────────────────────────────────
    const cacheKey = buildCacheKey(req.body as Record<string, unknown>);
    const cached = jobsCache.get(cacheKey);

    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.status(200).json(cached);
      return;
    }

    // ── Parallel scrape ───────────────────────────────────────────────────────
    const [rawLinkedInIndeed, rawGoogle] = await Promise.all([hasKeywords ? fetcher.fetchLinkedInIndeed(keywords!, location) : Promise.resolve([]), hasQuery ? fetcher.fetchGoogle(query!) : Promise.resolve([])]);

    if (rawLinkedInIndeed.length === 0 && rawGoogle.length === 0) {
      throw new AppError("Failed to fetch jobs: all sources returned empty results", 500);
    }

    // ── Prune + normalise ─────────────────────────────────────────────────────
    const googleJobs: Job[] = rawGoogle.map(pruneJob);
    const liJobs: Job[] = rawLinkedInIndeed.map(pruneJob);

    // ── Deduplicate (Google first, then LinkedIn/Indeed) ──────────────────────
    const jobs = deduplicateByUrl([...googleJobs, ...liJobs]);

    // ── Build response ────────────────────────────────────────────────────────
    const payload: JobsResponse = {
      message: "Jobs fetched successfully",
      total_jobs: jobs.length,
      jobs,
    };

    // ── Cache store ───────────────────────────────────────────────────────────
    jobsCache.set(cacheKey, payload);

    res.setHeader("X-Cache", "MISS");
    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
};
