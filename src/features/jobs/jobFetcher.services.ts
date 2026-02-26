import { scrapeJobs } from "ts-jobspy";

// ─── Constants ────────────────────────────────────────────────────────────────

const BATCH_SIZE = 3; // keywords per scrape call (smaller = faster, more relevant)
const RESULTS_PER_CALL = 10; // results per scrape call (reduced payload)
const SCRAPE_TIMEOUT_MS = 25_000; // 25 s per call before we give up

// ─── Timeout guard ────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timer = new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms));
  return Promise.race([promise, timer]);
}

// ─── Batch helpers ────────────────────────────────────────────────────────────

function splitIntoBatches<T>(arr: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    batches.push(arr.slice(i, i + size));
  }
  return batches;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class JobFetcherService {
  /**
   * Scrape LinkedIn + Indeed for an array of keywords.
   * Keywords are batched into groups of BATCH_SIZE and scraped concurrently.
   * Individual batch failures are swallowed — the rest still return.
   */
  async fetchLinkedInIndeed(keywords: string[], location = "Lebanon"): Promise<unknown[]> {
    const batches = splitIntoBatches(keywords, BATCH_SIZE);

    const results = await Promise.allSettled(
      batches.map((batch) =>
        withTimeout(
          scrapeJobs({
            siteName: ["indeed", "linkedin"],
            searchTerm: batch.join(" OR "),
            location,
            resultsWanted: RESULTS_PER_CALL,
            hoursOld: 24,
            countryIndeed: "Lebanon",
            linkedinFetchDescription: true,
            isRemote: false,
          }),
          SCRAPE_TIMEOUT_MS,
          `linkedin/indeed batch [${batch.join(", ")}]`,
        ),
      ),
    );

    const jobs: unknown[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        jobs.push(...(result.value as unknown[]));
      } else {
        console.warn("[JobFetcher] LinkedIn/Indeed batch failed:", result.reason?.message);
      }
    }
    return jobs;
  }

  /**
   * Scrape Google Jobs for a free-text query.
   * Returns an empty array on timeout or failure rather than throwing.
   */
  async fetchGoogle(query: string): Promise<unknown[]> {
    try {
      const jobs = await withTimeout(
        scrapeJobs({
          searchTerm: query,
          resultsWanted: RESULTS_PER_CALL,
          location: "worldwide",
        }),
        SCRAPE_TIMEOUT_MS,
        `google jobs [${query}]`,
      );
      return jobs as unknown[];
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[JobFetcher] Google Jobs failed:", msg);
      return [];
    }
  }
}
