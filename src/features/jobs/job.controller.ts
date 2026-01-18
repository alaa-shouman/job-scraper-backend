import { Request, Response, NextFunction } from "express";
import { JobFetcherService } from "./jobFetcher.service";

const jobFetcherService = new JobFetcherService();

export const getJobs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { keywords, location, query } = req.body;

    if (!keywords && !query) {
      return res.status(400).json({ message: "Keywords or query are required to fetch jobs." });
    }

    const [linkedinIndeedJobs, googleJobs] = await Promise.all([jobFetcherService.fetchJobs({ keywords: keywords || [], location }), query ? jobFetcherService.fetchGoogleJobs(query) : Promise.resolve([])]);

    res.status(200).json({
      message: "Jobs fetched successfully",
      total_jobs: linkedinIndeedJobs.length + googleJobs.length,
      jobs: googleJobs.concat(linkedinIndeedJobs),
    });
  } catch (error) {
    next(error);
  }
};
