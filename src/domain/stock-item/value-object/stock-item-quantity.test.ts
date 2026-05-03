import { describe, expect, it } from "bun:test";

import { StockItemQuantity } from "./stock-item-quantity";

describe("StockItemQuantity", () => {
  it("creates a valid quantity and returns its number", () => {
    const qty = StockItemQuantity.create(5);
    expect(qty.toNumber()).toBe(5);
  });

  it("does not allow non-finite quantity", () => {
    expect(() => StockItemQuantity.create(Number.POSITIVE_INFINITY)).toThrowError(
      "Stock item quantity must be a finite number",
    );
  });

  it("does not allow non-integer quantity", () => {
    expect(() => StockItemQuantity.create(1.5)).toThrowError(
      "Stock item quantity must be an integer",
    );
  });

  it("does not allow negative quantity", () => {
    expect(() => StockItemQuantity.create(-1)).toThrowError(
      "Stock item quantity must not be negative",
    );
  });

  it("increases quantity by another quantity", () => {
    const base = StockItemQuantity.create(3);
    const result = base.increase(StockItemQuantity.create(2));
    expect(result.toNumber()).toBe(5);
  });

  it("decreases quantity by another quantity", () => {
    const base = StockItemQuantity.create(5);
    const result = base.decrease(StockItemQuantity.create(2));
    expect(result.toNumber()).toBe(3);
  });

  it("does not allow decrease resulting in negative quantity", () => {
    const base = StockItemQuantity.create(1);
    expect(() => base.decrease(StockItemQuantity.create(2))).toThrowError(
      "Stock item quantity result must not be negative",
    );
  });
});
