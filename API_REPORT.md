# API Report

## Base URL
```
http://localhost:3000
```

---

## Endpoints

### `GET /health`
Returns a plain-text confirmation that the server is running.

**Response**
```
200 OK
server is running
```

---

### `POST /api/jobs`
Scrapes LinkedIn and Indeed for jobs matching the given criteria, applies post-scrape filters, and returns a paginated result.

Results are cached for 10 minutes — identical requests within that window are served from cache without hitting the scrapers.

#### Request body (`application/json`)

| Field | Type | Default | Description |
|---|---|---|---|
| `sites` | `("linkedin" \| "indeed")[]` | `["linkedin","indeed"]` | Scrapers to query |
| `query` | `string` | — | Free-text search term forwarded to scrapers |
| `exactKeywords` | `string[]` | — | Post-scrape: every word must appear as a whole word in title or description |
| `fuzzyKeywords` | `string[]` | — | Post-scrape: every word must appear as a substring in title or description |
| `booleanQuery` | `string` | — | Boolean expression: `AND`, `OR`, `NOT`, parentheses, quoted phrases |
| `location` | `string` | — | Location string, e.g. `"New York, NY"` |
| `locationMode` | `"exact" \| "near"` | `"exact"` | `"near"` expands search using `radius` |
| `radius` | `number` | — | Search radius in miles (required when `locationMode = "near"`, 1–500) |
| `remoteOnly` | `boolean` | — | Only return remote jobs |
| `excludeCountries` | `string[]` | — | Exclude jobs whose location contains any of these country names |
| `jobTypes` | `JobTypeFilter[]` | — | Filter by job type (see values below) |
| `minSalary` | `number` | — | Minimum annual salary |
| `maxSalary` | `number` | — | Maximum annual salary |
| `currency` | `string` | — | ISO 4217 currency code, e.g. `"USD"`. Excludes jobs with a different currency |
| `experienceLevels` | `ExperienceLevel[]` | — | Filter by seniority (see values below) |
| `page` | `number` | `1` | Page number (1-based) |
| `limit` | `number` | `10` | Results per page (1–100) |
| `sortBy` | `"relevance" \| "date" \| "salary"` | `"relevance"` | Sort order |
| `resultsWanted` | `number` | `25` | Raw results to request from each scraper before filtering (max 100) |
| `hoursOld` | `number` | — | Only return jobs posted within the last N hours |

#### `JobTypeFilter` values
`"fulltime"` `"parttime"` `"contract"` `"internship"` `"temporary"` `"freelance"` `"perdiem"` `"other"`

#### `ExperienceLevel` values
`"entry"` `"junior"` `"mid"` `"senior"` `"lead"` `"executive"`

#### Success response (`200 OK`)
```json
{
  "message": "Jobs fetched successfully",
  "total_jobs": 42,
  "total_pages": 5,
  "page": 1,
  "limit": 10,
  "jobs": [
    {
      "id": "abc123",
      "title": "Frontend Engineer",
      "company": "Acme Corp",
      "location": "New York, NY",
      "description": "...",
      "job_url": "https://linkedin.com/jobs/view/...",
      "source": "linkedin",
      "is_remote": false,
      "company_logo": "https://...",
      "date_posted": "2026-04-12",
      "min_amount": 120000,
      "max_amount": 160000,
      "currency": "USD",
      "pay_period": "yearly",
      "job_type": "fulltime",
      "job_level": "mid"
    }
  ]
}
```

#### Error responses

| Status | Cause |
|---|---|
| `400` | Invalid input (page < 1, limit out of range, missing radius, resultsWanted > 100) |
| `500` | Scraper error or unexpected server failure |

```json
{ "error": "radius is required when locationMode is 'near'" }
```

---

## Example requests

### Basic keyword search
```json
POST /api/jobs
{
  "query": "frontend engineer",
  "location": "Berlin",
  "limit": 20
}
```

### Boolean query with salary filter
```json
POST /api/jobs
{
  "query": "software engineer",
  "booleanQuery": "react AND (typescript OR javascript) NOT senior",
  "minSalary": 80000,
  "currency": "USD",
  "sortBy": "salary"
}
```

### Remote-only, recent postings
```json
POST /api/jobs
{
  "query": "data engineer",
  "remoteOnly": true,
  "hoursOld": 48,
  "experienceLevels": ["mid", "senior"],
  "sortBy": "date"
}
```

### Near-location search excluding a country
```json
POST /api/jobs
{
  "query": "product manager",
  "location": "London",
  "locationMode": "near",
  "radius": 50,
  "excludeCountries": ["India", "Pakistan"]
}
```

---

## Caching
- Strategy: in-memory TTL cache
- TTL: 10 minutes
- Key: stable JSON hash of the full request body (arrays are sorted before hashing)
- Cached responses include `"message": "Jobs fetched successfully (cached)"`
- Stale entries are evicted every 5 minutes

## Salary normalisation
All salary amounts are normalised to **annual** figures before filtering and sorting:

| Pay period | Multiplier |
|---|---|
| Hourly | × 2080 (52 wks × 40 hrs) |
| Daily | × 260 (52 wks × 5 days) |
| Weekly | × 52 |
| Monthly | × 12 |
| Yearly | × 1 |
