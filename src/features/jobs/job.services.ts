import { scrapeJobs } from "ts-jobspy";
import { pruneJob } from "../../utils/pruneJob";
import { Job, JobSearchRequest, ExperienceLevel, JobTypeFilter, SortBy } from "./job.type";

// ─── Boolean Query Parser ─────────────────────────────────────────────────────
// Grammar:
//   expr   := term (OR term)*
//   term   := factor (AND? factor)*  — stops at OR or ')'
//   factor := NOT factor | '(' expr ')' | word | "quoted phrase"

type Predicate = (text: string) => boolean;

/**
 * Tokenizes a boolean query string.
 * Quoted phrases like "machine learning" become single tokens.
 * Parentheses are emitted as individual tokens.
 */
function tokenize(query: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|([^\s()]+)|([()])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(query)) !== null) {
    const token = m[1] ?? m[2] ?? m[3] ?? "";
    if (token) tokens.push(token);
  }
  return tokens;
}

class BooleanParser {
  private readonly tokens: string[];
  private pos = 0;

  constructor(tokens: string[]) {
    this.tokens = tokens;
  }

  parse(): Predicate {
    return this.parseExpr();
  }

  private peek(): string | undefined {
    return this.tokens[this.pos];
  }

  private consume(): string {
    return this.tokens[this.pos++] ?? "";
  }

  /** expr := term (OR term)* */
  private parseExpr(): Predicate {
    let left = this.parseTerm();
    while (this.peek()?.toUpperCase() === "OR") {
      this.consume();
      const right = this.parseTerm();
      const l = left;
      const r = right;
      left = (text) => l(text) || r(text);
    }
    return left;
  }

  /** term := factor (AND? factor)* — stops at OR or ')' */
  private parseTerm(): Predicate {
    let left = this.parseFactor();
    while (true) {
      const next = this.peek();
      if (!next || next.toUpperCase() === "OR" || next === ")") break;
      if (next.toUpperCase() === "AND") this.consume();
      const right = this.parseFactor();
      const l = left;
      const r = right;
      left = (text) => l(text) && r(text);
    }
    return left;
  }

  /** factor := NOT factor | '(' expr ')' | word */
  private parseFactor(): Predicate {
    const token = this.peek();
    if (!token) return () => true;

    if (token.toUpperCase() === "NOT") {
      this.consume();
      const inner = this.parseFactor();
      return (text) => !inner(text);
    }

    if (token === "(") {
      this.consume();
      const inner = this.parseExpr();
      if (this.peek() === ")") this.consume();
      return inner;
    }

    this.consume();
    const word = token.toLowerCase();
    return (text) => text.toLowerCase().includes(word);
  }
}

function buildBooleanPredicate(query: string): Predicate | null {
  try {
    const tokens = tokenize(query);
    if (!tokens.length) return null;
    return new BooleanParser(tokens).parse();
  } catch {
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Compute a relevance score for a job based on keyword matches.
 * Title matches score higher than description matches.
 * Exact (whole-word) matches score higher than fuzzy (substring) matches.
 */
function computeRelevanceScore(job: Job, exactKeywords: string[], fuzzyKeywords: string[]): number {
  let score = 0;
  const title = (job.title ?? "").toLowerCase();
  const desc = (job.description ?? "").toLowerCase();

  for (const kw of exactKeywords) {
    const re = new RegExp(`\\b${escapeRegex(kw.toLowerCase())}\\b`);
    if (re.test(title)) score += 10;
    if (re.test(desc)) score += 3;
  }

  for (const kw of fuzzyKeywords) {
    const lower = kw.toLowerCase();
    if (title.includes(lower)) score += 5;
    if (desc.includes(lower)) score += 1;
  }

  return score;
}

/**
 * Normalise a salary amount to an approximate annual figure so ranges
 * are comparable regardless of the original pay period.
 */
function toAnnual(amount: number, payPeriod: string | undefined): number {
  const p = (payPeriod ?? "").toLowerCase();
  if (p.includes("hour")) return amount * 2_080; // 40 h × 52 wk
  if (p.includes("day")) return amount * 260;
  if (p.includes("week")) return amount * 52;
  if (p.includes("month")) return amount * 12;
  return amount; // assume yearly
}

// ─── Job type matching ────────────────────────────────────────────────────────

const JOB_TYPE_ALIASES: Record<string, string[]> = {
  fulltime: ["fulltime", "full_time", "full-time"],
  parttime: ["parttime", "part_time", "part-time"],
  contract: ["contract"],
  internship: ["internship"],
  temporary: ["temporary"],
  freelance: ["contract", "freelance"],
  perdiem: ["perdiem", "per_diem"],
  other: ["other"],
};

function matchesJobType(jobTypeStr: string | undefined, filters: JobTypeFilter[]): boolean {
  if (!jobTypeStr) return false;
  const norm = jobTypeStr.toLowerCase().replace(/[_\-\s]/g, "");
  return filters.some((f) => (JOB_TYPE_ALIASES[f] ?? [f]).some((alias) => norm === alias.replace(/[_\-\s]/g, "")));
}

// ─── Experience level matching ────────────────────────────────────────────────

// Patterns tested against concatenated `job_level + " " + title`.
// LinkedIn job levels use phrases like "Mid-Senior level", "Entry level", etc.
const EXPERIENCE_PATTERNS: Record<ExperienceLevel, RegExp> = {
  entry: /\b(entry[\s-]?level|internship|intern|junior|jr\.?|graduate|trainee|assistant)\b/i,
  junior: /\b(junior|jr\.?|associate|entry[\s-]?level|early[\s-]career)\b/i,
  mid: /\b(mid[\s-]?(level|senior)?|intermediate|associate)\b/i,
  senior: /\b(senior|sr\.?|mid[\s-]senior|experienced)\b/i,
  lead: /\b(lead|staff|principal|architect|tech(nical)?[\s-]lead|manager)\b/i,
  executive: /\b(director|vp|vice[\s-]?president|c[\s-]?level|c[\s-]?suite|chief|president|executive|head[\s-]of)\b/i,
};

function matchesExperienceLevel(job: Job, levels: ExperienceLevel[]): boolean {
  const combined = `${job.job_level ?? ""} ${job.title ?? ""}`;
  return levels.some((level) => EXPERIENCE_PATTERNS[level].test(combined));
}

// ─── Country exclusion ────────────────────────────────────────────────────────

function isExcludedByCountry(job: Job, excludeCountries: string[]): boolean {
  const loc = (job.location ?? "").toLowerCase();
  return excludeCountries.some((c) => loc.includes(c.toLowerCase()));
}

// ─── Sorting ──────────────────────────────────────────────────────────────────

function sortJobs(jobs: Job[], sortBy: SortBy): Job[] {
  return [...jobs].sort((a, b) => {
    switch (sortBy) {
      case "relevance":
        return (b.relevance_score ?? 0) - (a.relevance_score ?? 0);
      case "date": {
        const da = a.date_posted ? new Date(a.date_posted).getTime() : 0;
        const db = b.date_posted ? new Date(b.date_posted).getTime() : 0;
        return db - da;
      }
      case "salary": {
        const sa = a.max_amount ?? a.min_amount ?? 0;
        const sb = b.max_amount ?? b.min_amount ?? 0;
        return sb - sa;
      }
      default:
        return 0;
    }
  });
}

// ─── Main Service ─────────────────────────────────────────────────────────────

/**
 * Scrapes jobs from the configured sources, applies all post-scrape filters,
 * computes relevance scores, and returns the full sorted result set.
 *
 * Pagination is intentionally NOT applied here — the controller handles it so
 * that multiple pages can be served from a single shared cache entry.
 */
export async function fetchAndFilterJobs(params: JobSearchRequest): Promise<Job[]> {
  const {
    sites = ["linkedin", "indeed"],
    query,
    exactKeywords = [],
    fuzzyKeywords = [],
    booleanQuery,
    location,
    locationMode = "exact",
    radius,
    radiusUnit = "miles",
    remoteOnly = false,
    excludeCountries = [],
    jobTypes,
    minSalary,
    maxSalary,
    currency,
    experienceLevels,
    sortBy = "relevance",
    resultsWanted = 20,
    hoursOld,
  } = params;

  // Merge the free-text query with the keyword lists into one search term.
  const termParts = [query, ...exactKeywords, ...fuzzyKeywords].filter(Boolean);
  const searchTerm = termParts.length ? termParts.join(" ") : undefined;

  // Convert radius to miles (ts-jobspy distance is always in miles).
  let distanceMiles: number | undefined;
  if (locationMode === "near" && radius != null) {
    distanceMiles = radiusUnit === "km" ? Math.round(radius / 1.60934) : radius;
  }

  // ts-jobspy accepts one jobType string; map 'freelance' → 'contract'.
  const scrapeJobType = jobTypes?.length ? (jobTypes[0] === "freelance" ? "contract" : jobTypes[0]) : undefined;

  // ── Scrape ─────────────────────────────────────────────────────────────────
  const rawJobs = await scrapeJobs({
    siteName: sites,
    searchTerm,
    location,
    distance: distanceMiles,
    isRemote: remoteOnly || undefined,
    jobType: scrapeJobType,
    resultsWanted: Math.min(resultsWanted, 100),
    hoursOld,
    descriptionFormat: "markdown",
  });

  let jobs: Job[] = rawJobs.map(pruneJob);

  // ── Post-scrape filters ────────────────────────────────────────────────────

  if (remoteOnly) {
    jobs = jobs.filter((j) => j.is_remote || j.remote);
  }

  if (excludeCountries.length) {
    jobs = jobs.filter((j) => !isExcludedByCountry(j, excludeCountries));
  }

  const boolPred = booleanQuery ? buildBooleanPredicate(booleanQuery) : null;
  if (boolPred) {
    jobs = jobs.filter((j) => boolPred(`${j.title ?? ""} ${j.description ?? ""}`));
  }

  // Every exact keyword must appear as a whole word somewhere in the listing.
  if (exactKeywords.length) {
    jobs = jobs.filter((j) => {
      const text = `${j.title ?? ""} ${j.description ?? ""}`.toLowerCase();
      return exactKeywords.every((kw) => new RegExp(`\\b${escapeRegex(kw.toLowerCase())}\\b`).test(text));
    });
  }

  // Every fuzzy keyword must appear as a substring somewhere in the listing.
  if (fuzzyKeywords.length) {
    jobs = jobs.filter((j) => {
      const text = `${j.title ?? ""} ${j.description ?? ""}`.toLowerCase();
      return fuzzyKeywords.every((kw) => text.includes(kw.toLowerCase()));
    });
  }

  const effectiveJobTypes = jobTypes ?? [];
  if (effectiveJobTypes.length) {
    jobs = jobs.filter((j) => matchesJobType(j.job_type, effectiveJobTypes));
  }

  // Only exclude when the job explicitly lists a different currency; jobs with
  // no currency field pass through.
  if (currency) {
    const wanted = currency.toUpperCase();
    jobs = jobs.filter((j) => !j.currency || j.currency.toUpperCase() === wanted);
  }

  if (minSalary != null || maxSalary != null) {
    jobs = jobs.filter((j) => {
      const amount = j.max_amount ?? j.min_amount;
      if (amount == null) return false;
      const annual = toAnnual(amount, j.pay_period);
      if (minSalary != null && annual < minSalary) return false;
      if (maxSalary != null && annual > maxSalary) return false;
      return true;
    });
  }

  const effectiveLevels = experienceLevels ?? [];
  if (effectiveLevels.length) {
    jobs = jobs.filter((j) => matchesExperienceLevel(j, effectiveLevels));
  }

  // ── Relevance scoring ──────────────────────────────────────────────────────
  if (exactKeywords.length || fuzzyKeywords.length) {
    jobs = jobs.map((j) => ({
      ...j,
      relevance_score: computeRelevanceScore(j, exactKeywords, fuzzyKeywords),
    }));
  }

  // ── Sort and return ────────────────────────────────────────────────────────
  return sortJobs(jobs, sortBy);
}
