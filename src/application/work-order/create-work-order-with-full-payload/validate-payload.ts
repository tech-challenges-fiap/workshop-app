import type { CreateWorkOrderWithFullPayloadInput } from "../create-work-order-with-full-payload";

export class CreateWorkOrderPayloadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreateWorkOrderPayloadValidationError";
  }
}

export function validateCreateWorkOrderPayload(input: CreateWorkOrderWithFullPayloadInput): void {
  const partSkus = new Set<string>();

  for (const part of input.parts) {
    const normalizedSku = part.sku.trim();

    if (partSkus.has(normalizedSku)) {
      throw new CreateWorkOrderPayloadValidationError(
        `Part SKU "${part.sku}" is duplicated in payload`,
      );
    }

    partSkus.add(normalizedSku);
  }

  for (const service of input.services) {
    for (const requiredPart of service.requiredParts) {
      if (!partSkus.has(requiredPart.sku.trim())) {
        throw new CreateWorkOrderPayloadValidationError(
          `Service "${service.name}" references unknown SKU "${requiredPart.sku}"`,
        );
      }
    }
  }
}
