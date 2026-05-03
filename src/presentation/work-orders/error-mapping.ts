import type { Context } from "hono";
import { z } from "zod";

import { CreateWorkOrderPayloadValidationError } from "../../application/work-order/create-work-order-with-full-payload";
import { WorkOrderNotFound } from "../../domain/work-order/domain-error/work-order-not-found";
import { WorkOrderStatusTransitionNotAllowed } from "../../domain/work-order/domain-error/work-order-status-transition-not-allowed";
import { WorkOrderPublicTokenNotFound } from "../../domain/work-order/domain-error/work-order-public-token-not-found";
import { WorkOrderPublicTokenExpired } from "../../domain/work-order/domain-error/work-order-public-token-expired";
import { InvalidPersonDocument } from "../../domain/person/domain-error/invalid-person-document";
import { PersonDocumentAlreadyExists } from "../../domain/person/domain-error/person-document-already-exists";
import { PlateAlreadyExists } from "../../domain/vehicle/domain-error/plate-already-exists";
import { SkuAlreadyExists } from "../../domain/stock-item/domain-error/sku-already-exists";

type ErrorType = abstract new (...args: never[]) => Error;

interface ErrorGroups {
  badRequest?: ErrorType[];
  unauthorized?: ErrorType[];
  notFound?: ErrorType[];
  conflict?: ErrorType[];
}

export function mapCreateWorkOrderError(c: Context, error: unknown): Response {
  return mapRouteError(c, error, {
    badRequest: [InvalidPersonDocument, CreateWorkOrderPayloadValidationError],
    conflict: [PersonDocumentAlreadyExists, PlateAlreadyExists, SkuAlreadyExists],
  });
}

export function mapWorkOrderLookupError(c: Context, error: unknown): Response {
  return mapRouteError(c, error, {
    notFound: [WorkOrderNotFound],
  });
}

export function mapWorkOrderTransitionError(c: Context, error: unknown): Response {
  return mapRouteError(c, error, {
    notFound: [WorkOrderNotFound],
    conflict: [WorkOrderStatusTransitionNotAllowed],
  });
}

export function mapPublicWorkOrderError(c: Context, error: unknown): Response {
  return mapRouteError(c, error, {
    unauthorized: [WorkOrderPublicTokenExpired],
    notFound: [WorkOrderPublicTokenNotFound],
  });
}

export function mapMissingDependency(c: Context, message: string): Response {
  return c.json(
    {
      error: "UnexpectedError",
      message,
    },
    500,
  );
}

export function mapUnexpectedError(c: Context, error: unknown): Response {
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

function mapRouteError(c: Context, error: unknown, groups: ErrorGroups): Response {
  const validationError = mapValidationError(c, error);
  if (validationError) {
    return validationError;
  }

  const badRequestError = mapKnownError(c, error, groups.badRequest, 400);
  if (badRequestError) {
    return badRequestError;
  }

  const unauthorizedError = mapKnownError(c, error, groups.unauthorized, 401);
  if (unauthorizedError) {
    return unauthorizedError;
  }

  const notFoundError = mapKnownError(c, error, groups.notFound, 404);
  if (notFoundError) {
    return notFoundError;
  }

  const conflictError = mapKnownError(c, error, groups.conflict, 409);
  if (conflictError) {
    return conflictError;
  }

  return mapUnexpectedError(c, error);
}

function mapValidationError(c: Context, error: unknown): Response | null {
  if (!(error instanceof z.ZodError)) {
    return null;
  }

  return c.json(
    {
      error: "ValidationError",
      details: error.issues,
    },
    400,
  );
}

function mapKnownError(
  c: Context,
  error: unknown,
  expectedErrors: ErrorType[] | undefined,
  status: 400 | 401 | 404 | 409,
): Response | null {
  const matchedError = findMatchingError(error, expectedErrors);

  if (!matchedError) {
    return null;
  }

  return c.json(
    {
      error: matchedError.name,
      message: matchedError.message,
    },
    status,
  );
}

function findMatchingError(error: unknown, expectedErrors: ErrorType[] | undefined): Error | null {
  if (!expectedErrors) {
    return null;
  }

  for (const expectedError of expectedErrors) {
    if (error instanceof expectedError) {
      return error;
    }
  }

  return null;
}
