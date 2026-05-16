import type { Hono } from "hono";
import { z } from "zod";

import type { CreatePerson } from "../application/person/create-person";
import type { GetPersonById } from "../application/person/get-person-by-id";
import type { ListPersons } from "../application/person/list-persons";
import type { UpdatePerson } from "../application/person/update-person";
import type { DeletePerson } from "../application/person/delete-person";
import { PersonNotFound } from "../domain/person/domain-error/person-not-found";
import { PersonDocumentAlreadyExists } from "../domain/person/domain-error/person-document-already-exists";
import { InvalidPersonDocument } from "../domain/person/domain-error/invalid-person-document";
import { PresentationError } from "./presentation-error";

const createPersonBodySchema = z.object({
  name: z.string().min(1),
  document: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["customer", "mecanic", "front-desk"]),
  status: z.enum(["active", "inactive", "blocked"]).optional(),
});

const updatePersonBodySchema = z.object({
  name: z.string().min(1).optional(),
  document: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["customer", "mecanic", "front-desk"]).optional(),
  status: z.enum(["active", "inactive", "blocked"]).optional(),
});

const personIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const HTTP_STATUS_NOT_FOUND = 404;
const PERSON_ROUTE = "/person";
const PERSON_ID_ROUTE = "/person/:id";

export function registerPersonRoutes(
  app: Hono,
  deps: {
    createPerson: CreatePerson;
    getPersonById: GetPersonById;
    listPersons: ListPersons;
    updatePerson: UpdatePerson;
    deletePerson: DeletePerson;
  },
): void {
  app.post(PERSON_ROUTE, async (c) => {
    try {
      const parsed = createPersonBodySchema.parse(await c.req.json());

      const result = await deps.createPerson.execute({
        name: parsed.name,
        document: parsed.document,
        phone: parsed.phone,
        email: parsed.email,
        role: parsed.role,
        status: parsed.status,
      });

      return c.json(result, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return PresentationError.validation(c, error);
      }

      if (error instanceof PersonDocumentAlreadyExists) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          409,
        );
      }

      if (error instanceof InvalidPersonDocument) {
        return c.json(
          {
            error: "ValidationError",
            details: [{ message: error.message, path: ["document"] }],
          },
          400,
        );
      }

      if (error instanceof Error) {
        return PresentationError.unexpected(c, error);
      }

      return PresentationError.unknown(c);
    }
  });

  app.get(PERSON_ID_ROUTE, async (c) => {
    try {
      const params = personIdParamSchema.parse({ id: c.req.param("id") });

      const result = await deps.getPersonById.execute({ id: params.id });

      return c.json(result, 200);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return PresentationError.validation(c, error);
      }

      if (error instanceof PersonNotFound) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          HTTP_STATUS_NOT_FOUND,
        );
      }

      if (error instanceof Error) {
        return PresentationError.unexpected(c, error);
      }

      return PresentationError.unknown(c);
    }
  });

  app.get(PERSON_ROUTE, async (c) => {
    try {
      const result = await deps.listPersons.execute();

      return c.json(result, 200);
    } catch (error) {
      if (error instanceof Error) {
        return PresentationError.unexpected(c, error);
      }

      return PresentationError.unknown(c);
    }
  });

  app.put(PERSON_ID_ROUTE, async (c) => {
    try {
      const params = personIdParamSchema.parse({ id: c.req.param("id") });
      const parsed = updatePersonBodySchema.parse(await c.req.json());

      const result = await deps.updatePerson.execute({
        id: params.id,
        name: parsed.name,
        document: parsed.document,
        phone: parsed.phone,
        email: parsed.email,
        role: parsed.role,
        status: parsed.status,
      });

      return c.json(result, 200);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return PresentationError.validation(c, error);
      }

      if (error instanceof PersonNotFound) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          HTTP_STATUS_NOT_FOUND,
        );
      }

      if (error instanceof PersonDocumentAlreadyExists) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          409,
        );
      }

      if (error instanceof InvalidPersonDocument) {
        return c.json(
          {
            error: "ValidationError",
            details: [{ message: error.message, path: ["document"] }],
          },
          400,
        );
      }

      if (error instanceof Error) {
        return PresentationError.unexpected(c, error);
      }

      return PresentationError.unknown(c);
    }
  });

  app.delete(PERSON_ID_ROUTE, async (c) => {
    try {
      const params = personIdParamSchema.parse({ id: c.req.param("id") });

      await deps.deletePerson.execute({ id: params.id });

      return c.body(null, 204);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return PresentationError.validation(c, error);
      }

      if (error instanceof PersonNotFound) {
        return c.json(
          {
            error: error.name,
            message: error.message,
          },
          HTTP_STATUS_NOT_FOUND,
        );
      }

      if (error instanceof Error) {
        return PresentationError.unexpected(c, error);
      }

      return PresentationError.unknown(c);
    }
  });
}
