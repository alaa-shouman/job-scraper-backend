# Changelog

## Phase 1 — Core MVP

### New files
- `src/utils/mappers.ts` — Maps `JobData` (ts-jobspy) to the internal `Job` shape. Normalises salary to an annual figure using pay-period multipliers (hourly × 2080, daily × 260, weekly × 52, monthly × 12).
- `src/utils/filters.ts` — Pure post-scrape filter functions: exact-keyword (whole-word regex), fuzzy-keyword (substring), boolean query (AND/OR/NOT + parentheses parser), job-type, experience-level, salary range + currency, and country exclusion.

### Modified files
- `src/server.ts` — Mounted job routes at `/api` (`app.use('/api', jobRoutes)`). Previously the routes were defined but never registered.
- `src/features/jobs/job.type.ts` — Removed `googleQuery`, `googleResultsWanted` (Google scraper is under maintenance in ts-jobspy), and the deprecated `FetchJobsParams` interface. Removed redundant field aliases (`company_name`, `url`, `remote`).
- `src/features/jobs/job.services.ts` — Implemented `fetchJobs(params)`: builds `ScrapeJobsOptions`, calls `scrapeJobs()`, maps results, deduplicates by URL, applies all post-scrape filters, and sorts by relevance / date / salary.
- `src/features/jobs/job.controller.ts` — Implemented `getJobs` handler: validates input (page, limit, radius, resultsWanted), checks the TTL cache, calls `fetchJobs`, paginates, caches the full result array, and returns a `JobsResponse`.

### Notes
- `convertToAnnual` from ts-jobspy mutates its argument in-place and returns `void`; salary normalisation is handled manually instead.
- The scraper only accepts a single `jobType` value. When multiple `jobTypes` are requested, the first is forwarded to the scraper and the rest are enforced post-scrape by `matchesJobTypes`.
