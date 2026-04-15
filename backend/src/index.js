import "dotenv/config";
import express from "express";
import cors from "cors";
import { apiLimiter } from "./middleware/rateLimiter.js";
import healthRouter from "./routes/health.js";
import enrichRouter from "./routes/enrich.js";

const app = express();
const PORT = process.env.PORT || 3001;

// --- CORS ---
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((s) => s.trim())
  : ["http://localhost:5173"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, health checks)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
  })
);

// --- Body parsing ---
app.use(express.json({ limit: "10kb" }));

// --- Rate limiting on API routes ---
app.use("/api/", apiLimiter);

// --- Routes ---
app.use("/api/health", healthRouter);
app.use("/api/enrich", enrichRouter);

// --- Global error handler ---
app.use((err, _req, res, _next) => {
  console.error("[UNHANDLED]", err.message);
  res.status(500).json({
    error: true,
    message: "Internal server error",
    error_code: "INTERNAL_ERROR",
  });
});

app.listen(PORT, () => {
  console.log(`OutMate backend running on port ${PORT}`);
});
