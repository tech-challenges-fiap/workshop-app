import { describe, expect, it } from "bun:test";

import { StockItemSku } from "./stock-item-sku";

describe("StockItemSku", () => {
  it("creates a valid SKU and trims it", () => {
    const sku = StockItemSku.create("  BRAKE_PAD_001  ");
    expect(sku.toString()).toBe("BRAKE_PAD_001");
  });

  it("does not allow empty SKU", () => {
    expect(() => StockItemSku.create("   ")).toThrowError("Stock item SKU must not be empty");
  });
});
