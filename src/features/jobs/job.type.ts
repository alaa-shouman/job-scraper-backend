export interface Job {
  id: string;
  title: string;
  company?: string;
  company_name?: string;
  location?: string;
  description?: string;
  url?: string;
  job_url?: string;
  source: string;
  is_remote?: boolean;
  remote?: boolean;
  company_logo?: string;
  date_posted?: string;
  min_amount?: number;
  max_amount?: number;
  currency?: string;
  pay_period?: string;
  job_type?: string;
}

export interface JobsResponse {
  message: string;
  total_jobs: number;
  jobs: Job[];
}

export interface FetchJobsParams {
  keywords?: string[];
  location?: string;
  query?: string;
}
