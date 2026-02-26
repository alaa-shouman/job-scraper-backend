# Job Scraper Backend — API Report

**Base URL:** `http://localhost:3000`

---

## Health Check

### `GET /health`

Verifies the server is running.

**Request:** No parameters required.

**Response — `200 OK`**
```
server is running
```

---

## Jobs

### `POST /api/jobs`

Scrapes job listings from LinkedIn, Indeed, and/or Google Jobs depending on the provided body parameters. Keywords trigger a LinkedIn + Indeed scrape; a `query` string triggers a Google Jobs scrape. Both can be sent simultaneously.

---

### Request Body

`Content-Type: application/json`

| Field       | Type       | Required                     | Description                                                                                        |
|-------------|------------|------------------------------|----------------------------------------------------------------------------------------------------|
| `keywords`  | `string[]` | Required if `query` is absent | Array of job keywords. Batched in groups of 5 and joined with `OR` for each scrape call.           |
| `location`  | `string`   | Optional                     | Location filter for LinkedIn/Indeed scrape. Defaults to `"Lebanon"` if omitted.                   |
| `query`     | `string`   | Required if `keywords` is absent | Free-text search string used for Google Jobs scrape. Searches worldwide with up to 20 results.  |

> At least one of `keywords` or `query` must be provided.

**Example — keywords only:**
```json
{
  "keywords": ["frontend developer", "react", "typescript"],
  "location": "Lebanon"
}
```

**Example — query only:**
```json
{
  "query": "remote backend engineer node.js"
}
```

**Example — both:**
```json
{
  "keywords": ["UI designer"],
  "location": "Beirut",
  "query": "remote UI designer figma"
}
```

---

### Scraping Behaviour

| Source           | Triggered by | Sites scraped          | Results per batch | Hours old filter | Remote filter |
|------------------|--------------|------------------------|-------------------|------------------|---------------|
| LinkedIn + Indeed | `keywords`   | `indeed`, `linkedin`   | 20                | 24 hours         | `false` (default) |
| Google Jobs      | `query`      | Google Jobs (worldwide) | 20               | None             | N/A           |

---

### Responses

#### `200 OK` — Jobs fetched successfully

```json
{
  "message": "Jobs fetched successfully",
  "total_jobs": 35,
  "jobs": [
    {
      "id": "...",
      "title": "Frontend Developer",
      "company": "Acme Corp",
      "location": "Beirut, Lebanon",
      "description": "...",
      "url": "https://...",
      "source": "linkedin"
    }
  ]
}
```

| Field        | Type     | Description                                               |
|--------------|----------|-----------------------------------------------------------|
| `message`    | `string` | Always `"Jobs fetched successfully"`                      |
| `total_jobs` | `number` | Combined count of all jobs from all sources               |
| `jobs`       | `array`  | Google Jobs results first, followed by LinkedIn/Indeed results |

> The shape of individual job objects is determined by the `ts-jobspy` library.

---

#### `400 Bad Request` — Missing keywords and query

Returned when neither `keywords` nor `query` is provided in the request body.

```json
{
  "message": "Keywords or query are required to fetch jobs."
}
```

---

#### `500 Internal Server Error` — Scraping failure

Returned when the underlying scraper throws an error (e.g. network failure, upstream site change).

```json
{
  "error": "Failed to fetch jobs: <upstream error message>"
}
```

In development mode (`NODE_ENV=development`), a `stack` field is also included:

```json
{
  "error": "Failed to fetch jobs: <upstream error message>",
  "stack": "Error: ...\n    at ..."
}
```

---

## Error Response Schema (all endpoints)

| Field   | Type     | Description                                           |
|---------|----------|-------------------------------------------------------|
| `error` | `string` | Human-readable error message                          |
| `stack` | `string` | Stack trace — only present in `development` environment |

---

## Summary Table

| Method | Path        | Auth | Description                          |
|--------|-------------|------|--------------------------------------|
| GET    | `/health`   | None | Server health check                  |
| POST   | `/api/jobs` | None | Scrape jobs from LinkedIn/Indeed/Google |
