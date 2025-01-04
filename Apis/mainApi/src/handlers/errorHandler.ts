import { ErrorRequestHandler } from "express";
import { UnauthorizedError } from "express-oauth2-jwt-bearer";
import { AppError } from "../types";

export const errorHandler: ErrorRequestHandler = (
  err: AppError,
  req,
  res,
  next
): void => {
  if (err instanceof UnauthorizedError) {
    res.status(401).json({
      error: "Unauthorized",
      message: err.message,
      code: err.status,
    });
    return;
  }

  res.status(err.status || 500).json({
    error: err instanceof Error ? err.name : "InternalServerError",
    message: err.message || "An unexpected error occurred",
    code: err.code || "server_error",
  });
};
