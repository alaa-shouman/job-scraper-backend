# API Changes — Frontend Integration Guide

**Date:** March 6, 2026  
**Endpoint:** `POST /api/jobs`

---

## Breaking Changes

### Response shape has new fields

The `JobsResponse` object now includes pagination metadata. Update any type definitions or destructuring on the frontend.

**Before:**
```json
{
  "message": "Jobs fetched successfully",
  "total_jobs": 42,
  "jobs": [...]
}
```

**After:**
```json
{
  "message": "Jobs fetched successfully",
  "total_jobs": 42,
  "total_pages": 5,
  "page": 1,
  "limit": 10,
  "jobs": [...]
}
```

| New field | Type | Description |
|---|---|---|
| `total_pages` | `number` | Total number of pages for the current query |
| `page` | `number` | The current page that was returned |
| `limit` | `number` | The page size that was applied |

### Job object has new fields

Each job in the `jobs` array may now include:

| New field | Type | Description |
|---|---|---|
| `job_level` | `string \| undefined` | Seniority level reported by the job board (e.g. `"Mid-Senior level"`, `"Entry level"`) |
| `relevance_score` | `number \| undefined` | Computed match score — present only when `exactKeywords` or `fuzzyKeywords` are sent |

Also, `location` is now a full `"City, State, Country"` string where previously only one part (e.g. just the city) was returned.

---

## New Request Parameters

All parameters are optional. Send them in the JSON body of `POST /api/jobs`.

### Pagination

```json
{
  "page": 2,
  "limit": 20
}
```

| Field | Type | Default | Constraints |
|---|---|---|---|
| `page` | `number` | `1` | Positive integer |
| `limit` | `number` | `10` | 1 – 100 |

**How it works:** The first request scrapes and caches the full result set. Subsequent page requests for the same search are served instantly from the cache (10-minute TTL). Check the `X-Cache` response header: `HIT` means results came from cache, `MISS` means a live scrape occurred.

---

### Sorting

```json
{
  "sortBy": "date"
}
```

| Value | Behaviour |
|---|---|
| `"relevance"` | Highest `relevance_score` first (default) |
| `"date"` | Most recently posted first |
| `"salary"` | Highest `max_amount` first |

---

### Location — radius search

```json
{
  "location": "Austin, TX",
  "locationMode": "near",
  "radius": 50,
  "radiusUnit": "miles"
}
```

| Field | Type | Default | Notes |
|---|---|---|---|
| `locationMode` | `"exact" \| "near"` | `"exact"` | `"near"` activates radius search |
| `radius` | `number` | — | **Required** when `locationMode` is `"near"`. Range: 1 – 500 |
| `radiusUnit` | `"miles" \| "km"` | `"miles"` | km is converted to miles internally |

---

### Remote jobs

```json
{
  "remoteOnly": true
}
```

When `true`, only jobs flagged as remote are returned.

---

### Country exclusion

```json
{
  "excludeCountries": ["india", "pakistan"]
}
```

Jobs whose `location` string contains any of the listed country names are dropped. Matching is case-insensitive.

---

### Keyword matching

Three complementary keyword modes can be combined:

#### Exact keywords — whole-word match
Every keyword in the list must appear as a complete word somewhere in the job title or description.

```json
{
  "exactKeywords": ["react", "typescript"]
}
```

#### Fuzzy keywords — substring match
Every keyword in the list must appear as a substring anywhere in the job title or description.

```json
{
  "fuzzyKeywords": ["front-end", "UI/UX"]
}
```

#### Boolean query — advanced expression
Supports `AND`, `OR`, `NOT`, parentheses, and quoted phrases. Operators must be uppercase.

```json
{
  "booleanQuery": "react AND (typescript OR javascript) NOT senior"
}
```

```json
{
  "booleanQuery": "\"machine learning\" OR \"deep learning\""
}
```

When `exactKeywords` or `fuzzyKeywords` are provided, a `relevance_score` is added to each returned job. Use `"sortBy": "relevance"` (the default) to bubble up the best matches.

---

### Job type filtering

```json
{
  "jobTypes": ["fulltime", "contract"]
}
```

Accepted values: `"fulltime"`, `"parttime"`, `"contract"`, `"internship"`, `"temporary"`, `"freelance"`, `"perdiem"`, `"other"`

Multiple values mean "any of these types".

---

### Salary range

Salaries are compared on an **annual basis** regardless of how the job lists them (the backend normalises hourly/weekly/monthly figures automatically).

```json
{
  "minSalary": 80000,
  "maxSalary": 150000,
  "currency": "USD"
}
```

| Field | Type | Notes |
|---|---|---|
| `minSalary` | `number` | Annual amount |
| `maxSalary` | `number` | Annual amount |
| `currency` | `string` | ISO 4217 code. Jobs with no listed currency still pass through. |

Jobs that don't list any salary are excluded when a salary range is set.

---

### Experience level

```json
{
  "experienceLevels": ["mid", "senior"]
}
```

Accepted values: `"entry"`, `"junior"`, `"mid"`, `"senior"`, `"lead"`, `"executive"`

The backend matches against the `job_level` field and the job title. Multiple values mean "any of these levels".

---

### Source sites

```json
{
  "sites": ["linkedin"]
}
```

Default: both `"linkedin"` and `"indeed"`. Specify one to reduce scrape time.

---

### Results wanted & recency

```json
{
  "resultsWanted": 50,
  "hoursOld": 72
}
```

| Field | Type | Default | Notes |
|---|---|---|---|
| `resultsWanted` | `number` | `20` | Max raw results to fetch from the scraper before filtering. Range: 1 – 100. Increase this if filters are removing too many results. |
| `hoursOld` | `number` | — | Only return jobs posted within the last N hours |

---

## Rate Limiting

The API now enforces **60 requests per minute per IP**. If exceeded, the server responds with:

```json
HTTP 429 Too Many Requests

{
  "error": "Too many requests. Please try again in a minute."
}
```

Handle this on the frontend — add a `retry-after` delay or surface the message to the user.

---

## Error Responses

All validation errors return `400` with an `error` field:

```json
HTTP 400 Bad Request

{
  "error": "radius is required when locationMode is \"near\""
}
```

Common validation errors:

| Scenario | Message |
|---|---|
| `radius` out of range | `"radius must be a number between 1 and 500"` |
| `locationMode: "near"` without `radius` | `"radius is required when locationMode is \"near\""` |
| `page` not a positive integer | `"page must be a positive integer"` |
| `limit` out of range | `"limit must be a positive integer between 1 and 100"` |
| Invalid `sortBy` value | `"sortBy must be one of: relevance, date, salary"` |
| `resultsWanted` out of range | `"resultsWanted must be a number between 1 and 100"` |

---

## Complete Request Example

```json
POST /api/jobs
Content-Type: application/json

{
  "sites": ["linkedin", "indeed"],
  "query": "frontend engineer",
  "exactKeywords": ["react", "typescript"],
  "booleanQuery": "react AND (next.js OR vite) NOT junior",
  "location": "San Francisco, CA",
  "locationMode": "near",
  "radius": 25,
  "radiusUnit": "miles",
  "remoteOnly": false,
  "excludeCountries": ["india"],
  "jobTypes": ["fulltime", "contract"],
  "minSalary": 120000,
  "maxSalary": 200000,
  "currency": "USD",
  "experienceLevels": ["mid", "senior"],
  "sortBy": "relevance",
  "resultsWanted": 50,
  "hoursOld": 48,
  "page": 1,
  "limit": 10
}
```

**Response:**

```json
{
  "message": "Jobs fetched successfully",
  "total_jobs": 23,
  "total_pages": 3,
  "page": 1,
  "limit": 10,
  "jobs": [
    {
      "id": "linkedin-abc123",
      "title": "Senior Frontend Engineer",
      "company": "Acme Corp",
      "company_name": "Acme Corp",
      "location": "San Francisco, CA, United States",
      "description": "...",
      "url": "https://linkedin.com/jobs/...",
      "job_url": "https://linkedin.com/jobs/...",
      "source": "linkedin",
      "is_remote": false,
      "remote": false,
      "company_logo": "https://...",
      "date_posted": "2026-03-05",
      "min_amount": 140000,
      "max_amount": 180000,
      "currency": "USD",
      "pay_period": "yearly",
      "job_type": "fulltime",
      "job_level": "Mid-Senior level",
      "relevance_score": 23
    }
  ]
}
```

To fetch page 2 of the same search, send the identical body with `"page": 2`. The response will be served from cache (`X-Cache: HIT`) with no additional scraping.

---

# Update — March 9, 2026

## Cache removed

The in-memory TTL cache has been removed. Every request now performs a live scrape. The `X-Cache` response header is no longer sent.

---

## New: Google Jobs scraping (parallel with LinkedIn/Indeed)

The backend now scrapes **3 sources in parallel**:

- **LinkedIn + Indeed** — freshest listings (primary)
- **Google Jobs** — wider coverage, aggregates from dozens of job boards

All results are merged, deduplicated by URL, filtered, and sorted. Google scraping is automatic — if it fails, LinkedIn/Indeed results are still returned.

---

## New request fields

| Field                 | Type              | Default                  | Description                                                                 |
| --------------------- | ----------------- | ------------------------ | --------------------------------------------------------------------------- |
| `googleQuery`         | `string \| false` | Same as `query`          | Separate search term for Google Jobs. Set `false` to skip Google entirely.  |
| `googleResultsWanted` | `number (1–100)`  | Same as `resultsWanted`  | How many results to request from Google specifically.                       |

---

## Changed defaults

| Field            | Old default | New default |
| ---------------- | ----------- | ----------- |
| `resultsWanted`  | `20`        | `25`        |

---

## Improved location filtering

Location filtering is now stricter and more precise:

- **`locationMode: "exact"`** — at least one part of your requested location (city, state, country) must appear as a substring in the job's location. Jobs with no location info are **dropped**.
- **`locationMode: "near"`** — more lenient word-overlap matching. Jobs with no location info are **kept**. Common noise words like "metropolitan", "area", "greater", "region" are stripped before comparison.
- **Remote jobs always pass** both modes.

---

## No other breaking changes

All existing request fields and the response shape are unchanged. If you send the same request body as before, you'll just get **more results** from Google Jobs being included automatically.

---

## New validation errors

| Scenario | Message |
|---|---|
| `googleResultsWanted` out of range | `"googleResultsWanted must be a number between 1 and 100"` |
| `googleQuery` wrong type | `"googleQuery must be a string or false"` |

---

## Updated complete request example (maximum coverage)

```json
POST /api/jobs
Content-Type: application/json

{
  "sites": ["linkedin", "indeed"],
  "query": "frontend engineer",
  "googleQuery": "frontend engineer react jobs",
  "exactKeywords": ["react", "typescript"],
  "booleanQuery": "react AND (next.js OR vite) NOT junior",
  "location": "San Francisco, CA",
  "locationMode": "near",
  "radius": 25,
  "radiusUnit": "miles",
  "remoteOnly": false,
  "excludeCountries": ["india"],
  "jobTypes": ["fulltime", "contract"],
  "minSalary": 120000,
  "maxSalary": 200000,
  "currency": "USD",
  "experienceLevels": ["mid", "senior"],
  "sortBy": "date",
  "resultsWanted": 50,
  "googleResultsWanted": 50,
  "hoursOld": 48,
  "page": 1,
  "limit": 20
}
```
