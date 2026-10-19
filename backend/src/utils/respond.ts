import { Request, Response } from "express";

// Temporary. Tumi pore error handling korle ei file ta replace korlei hobe.
export function sendError(res: Response, error: unknown, label = "API") {
  const message = error instanceof Error ? error.message : "Unexpected error.";

  if (message.startsWith("Invalid ") || message.endsWith("is incorrect.")) {
    res.status(400).json({ success: false, message });
  } else if (message.endsWith("not found.")) {
    res.status(404).json({ success: false, message });
  } else if (message.includes("already exists")) {
    res.status(409).json({ success: false, message });
  } else if (error instanceof Error && error.name === "ValidationError") {
    res.status(400).json({ success: false, message: "Invalid data." });
  } else {
    console.error(`${label} failed:`, error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
}

export function readPaging(req: Request, defaultLimit = 20, maxLimit = 100) {
  return {
    page: Math.max(1, Number(req.query.page) || 1),
    limit: Math.min(maxLimit, Math.max(1, Number(req.query.limit) || defaultLimit)),
  };
}

export function readString(value: unknown, max = 100): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
}