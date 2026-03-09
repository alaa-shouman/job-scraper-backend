import { Request, Response, NextFunction } from "express";
import { fetchAndFilterJobs } from "./job.services";
import { Job, JobSearchRequest, JobsResponse } from "./job.type";
import { AppError } from "../../utils/AppError";

export async function getJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as JobSearchRequest;

    // ── Input validation ──────────────────────────────────────────────────────
    if (body.radius != null && (typeof body.radius !== "number" || body.radius < 1 || body.radius > 500)) {
      throw new AppError("radius must be a number between 1 and 500", 400);
    }

    if (body.locationMode === "near" && body.radius == null) {
      throw new AppError('radius is required when locationMode is "near"', 400);
    }

    if (body.page != null && (!Number.isInteger(body.page) || body.page < 1)) {
      throw new AppError("page must be a positive integer", 400);
    }

    if (body.limit != null && (!Number.isInteger(body.limit) || body.limit < 1 || body.limit > 100)) {
      throw new AppError("limit must be a positive integer between 1 and 100", 400);
    }

    if (body.sortBy != null && !["relevance", "date", "salary"].includes(body.sortBy)) {
      throw new AppError("sortBy must be one of: relevance, date, salary", 400);
    }

    if (body.resultsWanted != null && (typeof body.resultsWanted !== "number" || body.resultsWanted < 1 || body.resultsWanted > 100)) {
      throw new AppError("resultsWanted must be a number between 1 and 100", 400);
    }

    // ── Pagination params ─────────────────────────────────────────────────────
    const page = Math.max(1, body.page ?? 1);
    const limit = Math.min(100, Math.max(1, body.limit ?? 10));

    const allJobs: Job[] = await fetchAndFilterJobs(body);

    // ── Paginate ──────────────────────────────────────────────────────────────
    const total = allJobs.length;
    const totalPages = total > 0 ? Math.ceil(total / limit) : 1;
    const start = (page - 1) * limit;
    const pageJobs = allJobs.slice(start, start + limit);

    const response: JobsResponse = {
      message: pageJobs.length ? "Jobs fetched successfully" : "No jobs found",
      total_jobs: total,
      total_pages: totalPages,
      page,
      limit,
      jobs: pageJobs,
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
}
