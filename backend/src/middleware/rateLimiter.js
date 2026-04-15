import rateLimit from "express-rate-limit";

// Max 10 requests per IP per minute
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: true,
    message: "Too many requests. Please try again after a minute.",
    error_code: "RATE_LIMIT_EXCEEDED",
  },
});
