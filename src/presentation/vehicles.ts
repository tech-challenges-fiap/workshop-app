import type { Hono } from "hono";
import { z } from "zod";

import type { CreateVehicle } from "../application/vehicle/create-vehicle";
import type { GetVehicleById } from "../application/vehicle/get-vehicle-by-id";
import type { ListVehicles } from "../application/vehicle/list-vehicles";
import type { GetVehicleByPlate } from "../application/vehicle/get-vehicle-by-plate";
import type { UpdateVehicle } from "../application/vehicle/update-vehicle";
import type { DeleteVehicle } from "../application/vehicle/delete-vehicle";
import { VehicleNotFound } from "../domain/vehicle/domain-error/vehicle-not-found";
import { PlateAlreadyExists } from "../domain/vehicle/domain-error/plate-already-exists";
import { PersonNotFound } from "../domain/person/domain-error/person-not-found";
import { PresentationError } from "./presentation-error";

const createVehicleBodySchema = z.object({
  plate: z.string().min(1),
  brand: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(1900),
  ownerPersonId: z.coerce.number().int().positive(),
});

const updateVehicleBodySchema = z.object({
  plate: z.string().min(1).optional(),
  brand: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  year: z.number().int().min(1900).optional(),
  ownerPersonId: z.coerce.number().int().positive().optional(),
});

const vehicleIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const vehiclePlateParamSchema = z.object({
  plate: z
    .string()
    .trim()
    .min(1)
    .regex(/^(?:[A-Z]{3}-\d{4}|[A-Z]{3}\d[A-Z]\d{2})$/i, {
      message: "Invalid vehicle plate format",
    })
    .transform((value) => value.toUpperCase()),
});

const HTTP_STATUS_NOT_FOUND = 404;
const VEHICLES_ROUTE = "/vehicles";
const VEHICLE_ID_ROUTE = "/vehicles/:id";
const VEHICLE_BY_PLATE_ROUTE = "/vehicles/by-plate/:plate";

export function registerVehicleRoutes(
  app: Hono,
  deps: {
    createVehicle: CreateVehicle;
    getVehicleById: GetVehicleById;
    listVehicles: ListVehicles;
    getVehicleByPlate: GetVehicleByPlate;
    updateVehicle: UpdateVehicle;
    deleteVehicle: DeleteVehicle;
  },
): void {
  app.post(VEHICLES_ROUTE, async (c) => {
    try {
      const parsed = createVehicleBodySchema.parse(await c.req.json());

      const result = await deps.createVehicle.execute({
        plate: parsed.plate,
        brand: parsed.brand,
        model: parsed.model,
        year: parsed.year,
        ownerPersonId: parsed.ownerPersonId,
      });

      return c.json(result, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return PresentationError.validationFailed(c, error);
      }

      if (error instanceof PlateAlreadyExists) {
        return c.json({ error: error.message }, 409);
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

      return PresentationError.internalServer(c, error);
    }
  });

  app.get(VEHICLE_ID_ROUTE, async (c) => {
    try {
      const { id } = vehicleIdParamSchema.parse(c.req.param());
      const result = await deps.getVehicleById.execute({ id });
      return c.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return PresentationError.invalidIdFormat(c);
      }
      if (error instanceof VehicleNotFound) {
        return c.json({ error: error.message }, HTTP_STATUS_NOT_FOUND);
      }
      return PresentationError.internalServer(c, error);
    }
  });

  app.get(VEHICLES_ROUTE, async (c) => {
    try {
      const result = await deps.listVehicles.execute();
      return c.json(result);
    } catch (error) {
      return PresentationError.internalServer(c, error);
    }
  });

  app.get(VEHICLE_BY_PLATE_ROUTE, async (c) => {
    try {
      const { plate } = vehiclePlateParamSchema.parse(c.req.param());

      const result = await deps.getVehicleByPlate.execute({ plate });

      return c.json(result, 200);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return PresentationError.validationFailed(c, error);
      }

      if (error instanceof VehicleNotFound) {
        return c.json({ error: error.message }, HTTP_STATUS_NOT_FOUND);
      }

      return PresentationError.internalServer(c, error);
    }
  });

  app.put(VEHICLE_ID_ROUTE, async (c) => {
    try {
      const { id } = vehicleIdParamSchema.parse({ id: c.req.param("id") });
      const parsed = updateVehicleBodySchema.parse(await c.req.json());

      const result = await deps.updateVehicle.execute({
        id,
        ...parsed,
      });

      return c.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return PresentationError.validationFailed(c, error);
      }
      if (error instanceof VehicleNotFound) {
        return c.json({ error: error.message }, HTTP_STATUS_NOT_FOUND);
      }
      if (error instanceof PlateAlreadyExists) {
        return c.json({ error: error.message }, 409);
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
      return PresentationError.internalServer(c, error);
    }
  });

  app.delete(VEHICLE_ID_ROUTE, async (c) => {
    try {
      const { id } = vehicleIdParamSchema.parse(c.req.param());
      await deps.deleteVehicle.execute({ id });
      return c.body(null, 204);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return PresentationError.invalidIdFormat(c);
      }
      if (error instanceof VehicleNotFound) {
        return c.json({ error: error.message }, HTTP_STATUS_NOT_FOUND);
      }
      return PresentationError.internalServer(c, error);
    }
  });
}
