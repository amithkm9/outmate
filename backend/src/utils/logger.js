/**
 * Structured logger that logs request metadata without exposing secrets.
 */
export function logRequest({ prompt, entityType, resultCount, durationMs }) {
  const entry = {
    timestamp: new Date().toISOString(),
    promptLength: prompt?.length ?? 0,
    entityType: entityType ?? "unknown",
    resultCount: resultCount ?? 0,
    durationMs,
  };
  console.log("[REQUEST]", JSON.stringify(entry));
}

export function logError(context, error) {
  console.error(`[ERROR][${context}]`, {
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
  });
}
