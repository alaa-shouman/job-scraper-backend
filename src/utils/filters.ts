import { Job, JobTypeFilter, ExperienceLevel } from "../features/jobs/job.type";

// ─── Keyword filters ──────────────────────────────────────────────────────────

/**
 * Every keyword must appear as a whole word (case-insensitive) in the
 * job's title or description.
 */
export function matchesExactKeywords(job: Job, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const haystack = `${job.title} ${job.description ?? ""}`.toLowerCase();
  return keywords.every((kw) => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(haystack);
  });
}

/**
 * Every keyword must appear as a substring (case-insensitive) in the
 * job's title or description.
 */
export function matchesFuzzyKeywords(job: Job, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const haystack = `${job.title} ${job.description ?? ""}`.toLowerCase();
  return keywords.every((kw) => haystack.includes(kw.toLowerCase()));
}

// ─── Boolean query ────────────────────────────────────────────────────────────

/**
 * Evaluates a boolean search expression against a job.
 *
 * Grammar:
 *   expr   ::= term (('AND' | 'OR') term)*
 *   term   ::= 'NOT' term | '(' expr ')' | atom
 *   atom   ::= quoted_phrase | word
 *
 * Matching is substring, case-insensitive.
 */
export function evaluateBooleanQuery(job: Job, expr: string): boolean {
  if (!expr.trim()) return true;
  const haystack = `${job.title} ${job.description ?? ""}`.toLowerCase();
  try {
    const tokens = tokenize(expr);
    const result = parseExpr(tokens, haystack);
    return result.value;
  } catch {
    // Malformed expression — don't filter out the job
    return true;
  }
}

// ─── Boolean query parser ─────────────────────────────────────────────────────

type Token = string;

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    if (expr[i] === " ") { i++; continue; }
    if (expr[i] === "(" || expr[i] === ")") { tokens.push(expr[i++]); continue; }
    if (expr[i] === '"') {
      let j = i + 1;
      while (j < expr.length && expr[j] !== '"') j++;
      tokens.push(expr.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    let j = i;
    while (j < expr.length && expr[j] !== " " && expr[j] !== "(" && expr[j] !== ")") j++;
    tokens.push(expr.slice(i, j));
    i = j;
  }
  return tokens;
}

interface ParseResult { value: boolean; pos: number }

function parseExpr(tokens: Token[], haystack: string, pos = 0): ParseResult {
  let left = parseTerm(tokens, haystack, pos);
  pos = left.pos;

  while (pos < tokens.length) {
    const op = tokens[pos]?.toUpperCase();
    if (op === "AND") {
      const right = parseTerm(tokens, haystack, pos + 1);
      left = { value: left.value && right.value, pos: right.pos };
      pos = left.pos;
    } else if (op === "OR") {
      const right = parseTerm(tokens, haystack, pos + 1);
      left = { value: left.value || right.value, pos: right.pos };
      pos = left.pos;
    } else {
      break;
    }
  }
  return { value: left.value, pos };
}

function parseTerm(tokens: Token[], haystack: string, pos: number): ParseResult {
  if (tokens[pos]?.toUpperCase() === "NOT") {
    const inner = parseTerm(tokens, haystack, pos + 1);
    return { value: !inner.value, pos: inner.pos };
  }
  if (tokens[pos] === "(") {
    const inner = parseExpr(tokens, haystack, pos + 1);
    const closePos = inner.pos; // should be ")"
    return { value: inner.value, pos: closePos + 1 };
  }
  return parseAtom(tokens, haystack, pos);
}

function parseAtom(tokens: Token[], haystack: string, pos: number): ParseResult {
  const token = tokens[pos] ?? "";
  let term: string;
  if (token.startsWith('"') && token.endsWith('"')) {
    term = token.slice(1, -1).toLowerCase();
  } else {
    term = token.toLowerCase();
  }
  return { value: haystack.includes(term), pos: pos + 1 };
}

// ─── Job-type filter ──────────────────────────────────────────────────────────

export function matchesJobTypes(job: Job, types: JobTypeFilter[]): boolean {
  if (types.length === 0) return true;
  if (!job.job_type) return false;
  return types.some((t) => job.job_type!.toLowerCase().includes(t));
}

// ─── Experience-level filter ──────────────────────────────────────────────────

const LEVEL_KEYWORDS: Record<ExperienceLevel, string[]> = {
  entry:     ["entry", "junior", "associate", "graduate", "intern"],
  junior:    ["junior", "jr", "entry"],
  mid:       ["mid", "middle", "intermediate", "ii", "2"],
  senior:    ["senior", "sr", "principal", "staff"],
  lead:      ["lead", "tech lead", "team lead"],
  executive: ["director", "vp", "head of", "cto", "ceo", "chief", "executive"],
};

export function matchesExperienceLevels(
  job: Job,
  levels: ExperienceLevel[]
): boolean {
  if (levels.length === 0) return true;

  const haystack =
    `${job.job_level ?? ""} ${job.title}`.toLowerCase();

  return levels.some((level) =>
    LEVEL_KEYWORDS[level].some((kw) => haystack.includes(kw))
  );
}

// ─── Salary filter ────────────────────────────────────────────────────────────

export function matchesSalaryRange(
  job: Job,
  minSalary?: number,
  maxSalary?: number,
  currency?: string
): boolean {
  // If a currency filter is set and the job has a different currency, exclude it
  if (currency && job.currency && job.currency.toUpperCase() !== currency.toUpperCase()) {
    return false;
  }

  // No salary data on the job — can't filter, let it through
  const salary = job.max_amount ?? job.min_amount;
  if (salary == null) return true;

  if (minSalary != null && salary < minSalary) return false;
  if (maxSalary != null && salary > maxSalary) return false;
  return true;
}

// ─── Country exclusion filter ─────────────────────────────────────────────────

export function matchesExcludeCountries(
  job: Job,
  excludeCountries: string[]
): boolean {
  if (excludeCountries.length === 0) return true;
  if (!job.location) return true;
  const loc = job.location.toLowerCase();
  return !excludeCountries.some((c) => loc.includes(c.toLowerCase()));
}
