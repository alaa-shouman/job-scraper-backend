import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { errorHandler } from "./middleware/errorHandler";
import jobRoutes from "./features/jobs/job.routes";

dotenv.config();
const app = express();

app.use(
  cors({
    origin: "*",
    // credentials: true,
  }),
);
app.use(express.json());
app.use("/api", jobRoutes);
const server = http.createServer(app);

app.get("/health", (req, res) => {
  res.send("server is running");
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

export default app;
