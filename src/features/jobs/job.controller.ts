import { Request, Response, NextFunction } from "express";
import { JobFetcherService } from "./jobFetcher.service";

const jobFetcherService = new JobFetcherService();

/**
 * Controller to handle job fetching requests.
 * @param req - Express request object.
 * @param res - Express response object.
 */
export const getJobs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { keywords, location } = req.body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ message: "Keywords array is required to fetch jobs." });
    }

    const jobs = await jobFetcherService.fetchJobs({
      keywords,
      location,
    });

    res.status(200).json({ jobs });
  } catch (error) {
    next(error);
  }
};
