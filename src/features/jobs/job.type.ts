export interface Job {
  id: string;
  title: string;
  company?: string;
  company_name?: string;
  location?: string;
  description?: string;
  url?: string;
  job_url?: string;
  source: string;
  is_remote?: boolean;
  remote?: boolean;
  company_logo?: string;
  date_posted?: string;
  min_amount?: number;
  max_amount?: number;
  currency?: string;
  pay_period?: string;
  job_type?: string;
  job_level?: string;
  relevance_score?: number;
}

export interface JobsResponse {
  message: string;
  total_jobs: number;
  total_pages: number;
  page: number;
  limit: number;
  jobs: Job[];
}

export type JobTypeFilter = "fulltime" | "parttime" | "contract" | "internship" | "temporary" | "freelance" | "perdiem" | "other";

export type ExperienceLevel = "entry" | "junior" | "mid" | "senior" | "lead" | "executive";

export type SortBy = "relevance" | "date" | "salary";

export type LocationMode = "exact" | "near";

export interface JobSearchRequest {
  /** Job board sources. Defaults to both linkedin and indeed. */
  sites?: ("linkedin" | "indeed")[];

  /** Free-text query forwarded directly to the scraper. */
  query?: string;

  /** Post-scrape: every keyword must appear as a whole word in title or description. */
  exactKeywords?: string[];

  /** Post-scrape: every keyword must appear as a substring in title or description. */
  fuzzyKeywords?: string[];

  /**
   * Boolean search expression applied post-scrape.
   * Supports AND, OR, NOT and parentheses, e.g.
   * "react AND (typescript OR javascript) NOT senior"
   * Quoted phrases, e.g. "machine learning", are treated as single tokens.
   */
  booleanQuery?: string;

  /** Target location string forwarded to the scraper, e.g. "New York, NY". */
  location?: string;

  /**
   * 'exact' — rely on the scraper's default location behaviour.
   * 'near'  — expand search using `radius`. Default: 'exact'.
   */
  locationMode?: LocationMode;

  /** Search radius. Required when locationMode = 'near'. Range: 1–500. */
  radius?: number;

  /** Unit for the radius value. Default: 'miles'. */
  radiusUnit?: "miles" | "km";

  /** Only return remote jobs. */
  remoteOnly?: boolean;

  /** Exclude jobs whose location string contains any of these country names. */
  excludeCountries?: string[];

  /** Restrict to specific job types (applied post-scrape). */
  jobTypes?: JobTypeFilter[];

  /** Minimum annual salary (normalised from hourly/monthly when needed). */
  minSalary?: number;

  /** Maximum annual salary (normalised from hourly/monthly when needed). */
  maxSalary?: number;

  /** ISO 4217 currency code, e.g. "USD". Excludes jobs with a different listed currency. */
  currency?: string;

  /** Restrict to seniority levels (matched against jobLevel field and title). */
  experienceLevels?: ExperienceLevel[];

  /** Result page (1-based). Default: 1. */
  page?: number;

  /** Results per page. Default: 10. Max: 100. */
  limit?: number;

  /** How to order results. Default: 'relevance'. */
  sortBy?: SortBy;

  /** Total raw results to request from the scraper (before filtering). Default: 20. Max: 100. */
  resultsWanted?: number;

  /** Only return jobs posted within the last N hours. */
  hoursOld?: number;
}

/** @deprecated Use JobSearchRequest instead */
export interface FetchJobsParams {
  keywords?: string[];
  location?: string;
  query?: string;
}
