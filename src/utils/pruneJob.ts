import { Job } from "../features/jobs/job.type";

// ─── Source normalisation map ─────────────────────────────────────────────────

const SOURCE_MAP: Record<string, string> = {
  linkedin: "linkedin",
  indeed: "indeed",
  google: "google",
  google_jobs: "google",
  googlejobs: "google",
};

function normaliseSource(raw: unknown): string {
  if (typeof raw !== "string") return "unknown";
  const key = raw.toLowerCase().replace(/[^a-z_]/g, "");
  return SOURCE_MAP[key] ?? key;
}

// ─── Date normalisation ───────────────────────────────────────────────────────

function normaliseDate(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? undefined : raw.toISOString().slice(0, 10);
  }
  if (typeof raw === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
  }
  return undefined;
}

// ─── Number guard ─────────────────────────────────────────────────────────────

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && isFinite(v) ? v : undefined;
}

// ─── Main prune function ──────────────────────────────────────────────────────

/**
 * Strips a raw ts-jobspy job object down to exactly the fields the frontend
 * consumes, and applies all data-quality normalisations (Section 4).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pruneJob(raw: any): Job {
  const source = normaliseSource(raw.source ?? raw.site ?? raw.job_source ?? raw.job_provider);

  // Prefer job_url (ts-jobspy canonical field), fall back to url
  const jobUrl: string | undefined = typeof raw.job_url === "string" && raw.job_url ? raw.job_url : typeof raw.url === "string" && raw.url ? raw.url : undefined;

  // Build a stable id
  let id: string = typeof raw.id === "string" && raw.id ? raw.id : typeof raw.job_id === "string" && raw.job_id ? raw.job_id : "";

  if (!id && jobUrl) {
    id = `${source}-${Buffer.from(jobUrl).toString("base64").slice(0, 12)}`;
  } else if (!id) {
    id = `${source}-${Math.random().toString(36).slice(2, 14)}`;
  }

  const companyName: string | undefined = raw.company_name ?? raw.company ?? undefined;
  const isRemote: boolean | undefined = raw.is_remote ?? raw.remote ?? undefined;

  return {
    id,
    title: raw.title ?? raw.job_title ?? "",
    company: companyName,
    company_name: companyName,
    location: raw.location ?? raw.job_location ?? undefined,
    description: raw.description ?? raw.job_description ?? undefined,
    url: jobUrl,
    job_url: jobUrl,
    source,
    is_remote: isRemote,
    remote: isRemote,
    company_logo: raw.company_logo ?? raw.company_logo_url ?? undefined,
    date_posted: normaliseDate(raw.date_posted ?? raw.posted_date),
    min_amount: asNumber(raw.min_amount),
    max_amount: asNumber(raw.max_amount),
    currency: typeof raw.currency === "string" ? raw.currency : undefined,
    pay_period: typeof raw.pay_period === "string" ? raw.pay_period : typeof raw.interval === "string" ? raw.interval : undefined,
    job_type: typeof raw.job_type === "string" ? raw.job_type : typeof raw.employment_type === "string" ? raw.employment_type : undefined,
  };
}
