import { scrapeJobs, type ScrapeJobsOptions } from "ts-jobspy";
import { Job, JobSearchRequest } from "./job.type";
import { mapJobDataToJob } from "../../utils/mappers";
import {
  matchesExactKeywords,
  matchesFuzzyKeywords,
  evaluateBooleanQuery,
  matchesJobTypes,
  matchesExperienceLevels,
  matchesSalaryRange,
  matchesExcludeCountries,
} from "../../utils/filters";

export async function fetchJobs(params: JobSearchRequest): Promise<Job[]> {
  // ─── 1. Build scraper options ───────────────────────────────────────────────
  const options: ScrapeJobsOptions = {
    siteName: params.sites ?? ["linkedin", "indeed"],
    searchTerm: params.query,
    location: params.location,
    isRemote: params.remoteOnly,
    resultsWanted: Math.min(params.resultsWanted ?? 25, 100),
    hoursOld: params.hoursOld,
    descriptionFormat: "markdown",
  };

  if (params.locationMode === "near" && params.radius != null) {
    options.distance = params.radius;
  }

  // ts-jobspy accepts a single jobType — use the first one if provided;
  // remaining types are enforced post-scrape via the filter step
  if (params.jobTypes && params.jobTypes.length > 0) {
    options.jobType = params.jobTypes[0];
  }

  // ─── 2. Scrape ──────────────────────────────────────────────────────────────
  const rawJobs = await scrapeJobs(options);

  // ─── 3. Map JobData → Job ───────────────────────────────────────────────────
  const jobs: Job[] = rawJobs.map(mapJobDataToJob);

  // ─── 4. Deduplicate by URL ──────────────────────────────────────────────────
  const seen = new Set<string>();
  const unique = jobs.filter((job) => {
    const url = job.job_url ?? job.id;
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });

  // ─── 5. Post-scrape filters ─────────────────────────────────────────────────
  const filtered = unique.filter((job) => {
    if (
      params.exactKeywords?.length &&
      !matchesExactKeywords(job, params.exactKeywords)
    ) return false;

    if (
      params.fuzzyKeywords?.length &&
      !matchesFuzzyKeywords(job, params.fuzzyKeywords)
    ) return false;

    if (
      params.booleanQuery?.trim() &&
      !evaluateBooleanQuery(job, params.booleanQuery)
    ) return false;

    if (
      params.jobTypes && params.jobTypes.length > 1 &&
      !matchesJobTypes(job, params.jobTypes)
    ) return false;

    if (
      params.experienceLevels?.length &&
      !matchesExperienceLevels(job, params.experienceLevels)
    ) return false;

    if (
      (params.minSalary != null || params.maxSalary != null || params.currency) &&
      !matchesSalaryRange(job, params.minSalary, params.maxSalary, params.currency)
    ) return false;

    if (
      params.excludeCountries?.length &&
      !matchesExcludeCountries(job, params.excludeCountries)
    ) return false;

    return true;
  });

  // ─── 6. Sort ────────────────────────────────────────────────────────────────
  const sortBy = params.sortBy ?? "relevance";

  if (sortBy === "date") {
    filtered.sort((a, b) => {
      const da = a.date_posted ? new Date(a.date_posted).getTime() : 0;
      const db = b.date_posted ? new Date(b.date_posted).getTime() : 0;
      return db - da;
    });
  } else if (sortBy === "salary") {
    filtered.sort((a, b) => {
      const sa = a.max_amount ?? a.min_amount ?? 0;
      const sb = b.max_amount ?? b.min_amount ?? 0;
      return sb - sa;
    });
  }
  // 'relevance' → keep scraper-native order

  return filtered;
}
