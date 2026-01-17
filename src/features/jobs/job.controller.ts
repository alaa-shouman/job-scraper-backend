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
    const { keywords, location, query } = req.body;

    // Validate required parameters
    if (!keywords && !query) {
      return res.status(400).json({ message: "Keywords or query are required to fetch jobs." });
    }

    // Run LinkedIn/Indeed and Google job fetchers in parallel
    const [linkedinIndeedJobs, googleJobs] = await Promise.all([jobFetcherService.fetchJobs({ keywords: keywords || [], location }), query ? jobFetcherService.fetchGoogleJobs(query) : Promise.resolve([])]);

    res.status(200).json({
      message: "Jobs fetched successfully",
      length: linkedinIndeedJobs.length + googleJobs.length,
      googleJobs: {
        source: "fetchGoogleJobs",
        total: googleJobs.length,
        jobs: googleJobs,
      },
      linkedinIndeedJobs: {
        source: "fetchJobs LinkedIn/Indeed",
        total: linkedinIndeedJobs.length,
        jobs: linkedinIndeedJobs,
      }
    });
  } catch (error) {
    next(error);
  }
};
