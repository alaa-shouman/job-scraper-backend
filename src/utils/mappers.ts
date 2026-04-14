import { type JobData } from "ts-jobspy";
import { Job } from "../features/jobs/job.type";

/**
 * Maps a flat JobData record from ts-jobspy into our internal Job shape.
 * Salary is normalised to annual equivalent when the pay period is not yearly.
 */
export function mapJobDataToJob(raw: JobData): Job {
  const minAmount = normalizeToAnnual(raw.minAmount, raw.interval);
  const maxAmount = normalizeToAnnual(raw.maxAmount, raw.interval);

  return {
    id: raw.id ?? hashUrl(raw.jobUrl),
    title: raw.title,
    company: raw.company ?? undefined,
    location: raw.location ?? undefined,
    description: raw.description ?? undefined,
    job_url: raw.jobUrl,
    source: raw.site,
    is_remote: raw.isRemote ?? undefined,
    company_logo: raw.companyLogo ?? undefined,
    date_posted: raw.datePosted ?? undefined,
    min_amount: minAmount ?? undefined,
    max_amount: maxAmount ?? undefined,
    currency: raw.currency ?? undefined,
    pay_period: "yearly",
    job_type: raw.jobType ?? undefined,
    job_level: raw.jobLevel ?? undefined,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Multipliers to convert a pay-period amount to an annual figure. */
const ANNUAL_MULTIPLIER: Record<string, number> = {
  hourly:  2080,  // 52 weeks × 40 hours
  daily:   260,   // 52 weeks × 5 days
  weekly:  52,
  monthly: 12,
  yearly:  1,
};

function normalizeToAnnual(
  amount: number | null,
  interval: string | null
): number | null {
  if (amount == null) return null;
  if (interval == null) return amount;
  const multiplier = ANNUAL_MULTIPLIER[interval.toLowerCase()];
  return multiplier != null ? Math.round(amount * multiplier) : amount;
}

/**
 * Simple FNV-1a-style hash used as a fallback ID when the scraper
 * does not provide one.
 */
function hashUrl(url: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16);
}
