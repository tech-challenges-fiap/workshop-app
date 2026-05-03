import type { Context } from "hono";
import type { ZodError } from "zod";

export class PresentationError {
  static validation(context: Context, error: ZodError): Response {
    return context.json(
      {
        error: "ValidationError",
        details: error.issues,
      },
      400,
    );
  }

  static unexpected(context: Context, error: Error): Response {
    console.error(error);
    return context.json(
      {
        error: "UnexpectedError",
        message: error.message,
      },
      500,
    );
  }

  static unknown(context: Context): Response {
    return context.json({ error: "UnknownError" }, 500);
  }

  static validationFailed(context: Context, error: ZodError): Response {
    return context.json(
      {
        error: "Validation failed",
        details: error.issues,
      },
      400,
    );
  }

  static invalidIdFormat(context: Context): Response {
    return context.json({ error: "Invalid ID format" }, 400);
  }

  static internalServer(context: Context, error: unknown): Response {
    console.error(error);
    return context.json({ error: "Internal server error" }, 500);
  }
}
