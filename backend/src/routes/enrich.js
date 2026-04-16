import { Router } from "express";
import { parsePromptToFilters } from "../services/gemini.js";
import { searchAndEnrich } from "../services/explorium.js";
import { logRequest, logError } from "../utils/logger.js";

const router = Router();
const isDev = process.env.NODE_ENV === "development";

/**
 * POST /api/enrich
 *
 * Accepts { prompt: string }, calls Gemini to parse filters,
 * calls Explorium to search/enrich, returns max 3 normalized records.
 */
router.post("/", async (req, res, next) => {
  const start = Date.now();

  try {
    // ── Step 0: Validate input ──
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        error: true,
        message: "Prompt is required and must be a non-empty string.",
        error_code: "INVALID_PROMPT",
      });
    }

    const trimmed = prompt.trim();
    if (trimmed.length === 0 || trimmed.length > 2000) {
      return res.status(400).json({
        error: true,
        message: "Prompt must be between 1 and 2000 characters.",
        error_code: "INVALID_PROMPT_LENGTH",
      });
    }

    // ── Step 1: NLP parsing via Gemini ──
    let parsedFilters;
    try {
      parsedFilters = await parsePromptToFilters(trimmed);
    } catch (err) {
      // Off-topic / irrelevant prompt → 400 (not a server error)
      if (err.code === "IRRELEVANT_PROMPT") {
        return res.status(400).json({
          error: true,
          message: err.message,
          error_code: "IRRELEVANT_PROMPT",
        });
      }
      logError("gemini", err);
      return res.status(502).json({
        error: true,
        message: isDev
          ? `AI parsing failed: ${err.message}`
          : "Failed to understand your prompt. Please try rephrasing.",
        error_code: "GEMINI_ERROR",
      });
    }

    // ── Step 2: Data enrichment via Explorium ──
    let results;
    try {
      results = await searchAndEnrich(parsedFilters.entity_type, parsedFilters.filters);
    } catch (err) {
      logError("explorium", err);
      return res.status(502).json({
        error: true,
        message: isDev
          ? `Enrichment failed: ${err.message}`
          : "Failed to fetch enrichment data. Please try again.",
        error_code: "EXPLORIUM_ERROR",
      });
    }

    // ── Step 3: Respond ──
    const durationMs = Date.now() - start;

    logRequest({
      prompt: trimmed,
      entityType: parsedFilters.entity_type,
      resultCount: results.length,
      durationMs,
    });

    return res.json({
      results,
      meta: {
        entity_type: parsedFilters.entity_type,
        filters_used: parsedFilters.filters,
        total_results: results.length,
        duration_ms: durationMs,
      },
    });
  } catch (err) {
    // Catch-all: any unexpected error bubbles to Express global handler
    next(err);
  }
});

export default router;
