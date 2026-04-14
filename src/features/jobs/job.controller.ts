import { Request, Response, NextFunction } from "express";
import { fetchJobs } from "./job.services";
import { JobSearchRequest, JobsResponse } from "./job.type";
import { AppError } from "../../utils/AppError";
import { jobsCache, buildCacheKey } from "../../lib/cache";

export async function getJobs(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as JobSearchRequest;

    // ─── Validate ─────────────────────────────────────────────────────────────
    const page = body.page ?? 1;
    const limit = body.limit ?? 50;

    if (page < 1) {
      throw new AppError("page must be >= 1", 400);
    }
    if (limit < 1 || limit > 100) {
      throw new AppError("limit must be between 1 and 100", 400);
    }
    if (body.locationMode === "near" && body.radius == null) {
      throw new AppError("radius is required when locationMode is 'near'", 400);
    }
    if (body.radius != null && (body.radius < 1 || body.radius > 500)) {
      throw new AppError("radius must be between 1 and 500", 400);
    }
    if (body.resultsWanted != null && body.resultsWanted > 100) {
      throw new AppError("resultsWanted cannot exceed 100", 400);
    }

    // ─── Cache lookup ─────────────────────────────────────────────────────────
    // Exclude pagination params — the cache holds the full result array and
    // slices it per page, so page/limit must not affect the cache key.
    const { page: _p, limit: _l, ...searchParams } = body;
    const cacheKey = buildCacheKey(searchParams as Record<string, unknown>);
    const cached = jobsCache.get(cacheKey);

    if (cached) {
      const total = cached.length;
      const totalPages = Math.ceil(total / limit);
      const paged = cached.slice((page - 1) * limit, page * limit);

      const response: JobsResponse = {
        message: "Jobs fetched successfully (cached)",
        total_jobs: total,
        total_pages: totalPages,
        page,
        limit,
        jobs: paged,
      };
      res.json(response);
      return;
    }

    // ─── Fetch + cache ────────────────────────────────────────────────────────
    const allJobs = await fetchJobs({ ...body, page, limit });

    jobsCache.set(cacheKey, allJobs);

    const total = allJobs.length;
    const totalPages = Math.ceil(total / limit);
    const paged = allJobs.slice((page - 1) * limit, page * limit);

    const response: JobsResponse = {
      message: "Jobs fetched successfully",
      total_jobs: total,
      total_pages: totalPages,
      page,
      limit,
      jobs: paged,
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
}
