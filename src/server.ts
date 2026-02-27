import http from "http";
import https from "https";
import express, { Request, Response } from "express";
import cors from "cors";
import compression from "compression";
import dotenv from "dotenv";
import { errorHandler } from "./middleware/errorHandler";
import jobRoutes from "./features/jobs/job.routes";

dotenv.config();

// ─── Keep-Alive agents ────────────────────────────────────────────────────────
// Reuse TCP connections across upstream scrape calls within the same process.
http.globalAgent = new http.Agent({ keepAlive: true });
https.globalAgent = new https.Agent({ keepAlive: true });

// ─── App ──────────────────────────────────────────────────────────────────────
const app = express();

// ─── Compression ─────────────────────────────────────────────────────────────
// Gzip/Brotli all responses — cuts job description payloads by ~65 %.
app.use(compression());

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    exposedHeaders: ["X-Cache"],
  }),
);

// ─── Body parser ─────────────────────────────────────────────────────────────
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api", jobRoutes);

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
