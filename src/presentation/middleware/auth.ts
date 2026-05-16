import type { MiddlewareHandler } from "hono";

import { verifyAuthContext } from "../../infrastructure/auth/jwt";
import {
  InactivePersonTokenError,
  InvalidTokenError,
  TokenExpiredError,
} from "../../infrastructure/auth/jwt";
import { authFailureCounter } from "../../infrastructure/observability/telemetry";

function forbidden(message: string): Response {
  return Response.json(
    {
      error: "Forbidden",
      message,
    },
    { status: 403 },
  );
}

export function requireAuth(allowedRoles?: readonly string[]): MiddlewareHandler {
  return async (c, next) => {
  const authHeader = c.req.header("authorization") ?? c.req.header("Authorization");

  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return c.json(
      {
        error: "Unauthorized",
        message: "Missing or invalid Authorization header",
      },
      401,
    );
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return c.json(
      {
        error: "Unauthorized",
        message: "Missing bearer token",
      },
      401,
    );
  }

  try {
    const authContext = verifyAuthContext(token);

    if (allowedRoles && !allowedRoles.includes(authContext.role)) {
      authFailureCounter.add(1, { reason: "role_not_allowed", role: authContext.role });
      return forbidden("Authenticated role is not allowed for this route");
    }

    c.set("auth", authContext);

    await next();
  } catch (error) {
    if (error instanceof InactivePersonTokenError) {
      authFailureCounter.add(1, { reason: "inactive_status" });
      return c.json(
        {
          error: "Forbidden",
          message: error.message,
        },
        403,
      );
    }

    if (error instanceof TokenExpiredError) {
      authFailureCounter.add(1, { reason: "expired" });
      return c.json(
        {
          error: "TokenExpired",
          message: error.message,
        },
        401,
      );
    }

    if (error instanceof InvalidTokenError) {
      authFailureCounter.add(1, { reason: "invalid" });
      return c.json(
        {
          error: "InvalidToken",
          message: error.message,
        },
        401,
      );
    }

    if (error instanceof Error) {
      console.error(error);
      return c.json(
        {
          error: "UnexpectedError",
          message: error.message,
        },
        500,
      );
    }

    return c.json({ error: "UnknownError" }, 500);
  }
  };
}

export const adminAuthMiddleware = requireAuth(["front-desk"]);
export const mechanicAuthMiddleware = requireAuth(["front-desk", "mecanic"]);
