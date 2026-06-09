import type { Response } from "express";

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string) {
    super(400, message);
    this.name = "BadRequestError";
  }
}

export function handleApiError(res: Response, err: unknown, context: string) {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      error: err.message,
    });
    return;
  }

  console.error(`[API] ${context}:`, err);

  res.status(500).json({
    error: "Internal server error",
  });
}