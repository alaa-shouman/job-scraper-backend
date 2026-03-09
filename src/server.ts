import http from "http";
import https from "https";
import express, { Request, Response } from "express";
import cors from "cors";
import compression from "compression";
import dotenv from "dotenv";
import { errorHandler } from "./middleware/errorHandler";
import { rateLimit } from "./middleware/rateLimit";
import jobRoutes from "./features/jobs/job.routes";

dotenv.config();

http.globalAgent = new http.Agent({ keepAlive: true });
https.globalAgent = new https.Agent({ keepAlive: true });

// ─── App ──────────────────────────────────────────────────────────────────────
const app = express();

// ─── Security headers ────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

// ─── Compression ─────────────────────────────────────────────────────────────
// Gzip/Brotli all responses — cuts job description payloads by ~65 %.
app.use(compression());

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);

// ─── Body parser ─────────────────────────────────────────────────────────────
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api", rateLimit, jobRoutes);

app.get("/health", (_req: Request, res: Response) => {
  res.send("server is running");
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Server ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 3000;
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

export default app;
