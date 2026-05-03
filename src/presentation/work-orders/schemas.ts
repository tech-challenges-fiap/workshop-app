import { z } from "zod";

export const workOrderIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const publicTokenParamSchema = z.object({
  token: z.string().min(1),
});

const createWorkOrderPartSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().default(null),
  quantity: z.coerce.number().int().nonnegative(),
  unitOfMeasure: z.string().nullable().default(null),
  price: z.coerce.number().nonnegative(),
});

const createWorkOrderServicePartReferenceSchema = z.object({
  sku: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
});

const createWorkOrderServiceSchema = z.object({
  name: z.string().min(1),
  estimatedTime: z.coerce.number().int().positive(),
  price: z.coerce.number().nonnegative(),
  requiredParts: z.array(createWorkOrderServicePartReferenceSchema).default([]),
});

export const createWorkOrderBodySchema = z.object({
  customer: z.object({
    name: z.string().min(1),
    document: z.string().min(1),
    phone: z.string().min(1),
    email: z.string().email(),
    role: z.literal("customer"),
    status: z.enum(["active", "inactive", "blocked"]).optional(),
  }),
  vehicle: z.object({
    plate: z.string().min(1),
    brand: z.string().min(1),
    model: z.string().min(1),
    year: z.coerce.number().int().min(1900),
  }),
  parts: z.array(createWorkOrderPartSchema).min(1),
  services: z.array(createWorkOrderServiceSchema).min(1),
});
