import { scrapeJobs } from "ts-jobspy";
import { AppError } from "../../utils/AppError";

type Filters = {
  keywords: string[];
  location?: string;
  isRemote?: boolean;
  resultsWanted?: number;
};

export class JobFetcherService {
  async fetchJobs({ keywords, location, isRemote, resultsWanted }: Filters) {
    try {
      // Process keywords in batches
      const batchSize = 5;
      const keywordBatches = this.splitIntoBatches(keywords, batchSize);

      const allJobs = await Promise.all(
        keywordBatches.map(async (batch) => {
          const jobs = await scrapeJobs({
            siteName: ["indeed", "linkedin"],
            searchTerm: batch.join(" OR "),
            location: location || "Lebanon",
            resultsWanted: resultsWanted || 20,
            hoursOld: 24,
            countryIndeed: "Lebanon",
            linkedinFetchDescription: true,
            isRemote: isRemote || false,
          });
          return jobs;
        }),
      );

      return allJobs.flat();
    } catch (error: any) {
      throw new AppError(`Failed to fetch jobs: ${error.message}`, 500);
    }
  }

  async fetchGoogleJobs(query: string) {
    try {
      const jobs = await scrapeJobs({
        searchTerm: query,
        resultsWanted: 20,
        location: "worldwide",
      });

      return jobs;
    } catch (error: any) {
      throw new AppError(`Failed to fetch Google jobs: ${error.message}`, 500);
    }
  }

  private splitIntoBatches(keywords: string[], batchSize: number): string[][] {
    const batches: string[][] = [];
    for (let i = 0; i < keywords.length; i += batchSize) {
      batches.push(keywords.slice(i, i + batchSize));
    }
    return batches;
  }

}
