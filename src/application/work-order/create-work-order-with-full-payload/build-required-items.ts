import type { CreateWorkOrderServiceInput } from "../create-work-order-with-full-payload";
import { CreateWorkOrderPayloadValidationError } from "./validate-payload";

export function buildRequiredItems(
  service: CreateWorkOrderServiceInput,
  partIdsBySku: ReadonlyMap<string, number>,
): { stockItemId: number; quantity: number }[] {
  return service.requiredParts.map((requiredPart) => {
    const stockItemId = partIdsBySku.get(requiredPart.sku.trim());

    if (!stockItemId) {
      throw new CreateWorkOrderPayloadValidationError(
        `Part with SKU "${requiredPart.sku}" was not found in payload`,
      );
    }

    return {
      stockItemId,
      quantity: requiredPart.quantity,
    };
  });
}
