import { Request, Response, NextFunction } from "express";

// ─── Simple sliding-window rate limiter (no external dependencies) ────────────

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 60; // requests per window per IP

interface WindowEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, WindowEntry>();

// Purge expired windows every 5 minutes to prevent unbounded memory growth.
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of store) {
    if (now - entry.windowStart > WINDOW_MS) store.delete(ip);
  }
}, 5 * 60_000).unref();

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const now = Date.now();

  const entry = store.get(ip);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    store.set(ip, { count: 1, windowStart: now });
    next();
    return;
  }

  if (entry.count >= MAX_REQUESTS) {
    res.status(429).json({
      error: "Too many requests. Please try again in a minute.",
    });
    return;
  }

  entry.count += 1;
  next();
}
