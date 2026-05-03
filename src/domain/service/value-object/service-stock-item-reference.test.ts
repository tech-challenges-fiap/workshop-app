import { describe, expect, it } from "bun:test";

import { ServiceStockItemsRequired } from "./service-stock-item-reference";

describe("ServiceStockItemsRequired", () => {
  it("creates a valid reference and returns a snapshot", () => {
    const required = ServiceStockItemsRequired.create({
      stockItemId: 1,
      quantity: 2,
    });

    expect(required.toSnapshot()).toEqual({
      stockItemId: 1,
      quantity: 2,
    });
  });

  it("does not allow non-finite quantity", () => {
    expect(() =>
      ServiceStockItemsRequired.create({
        stockItemId: 1,
        quantity: Number.NaN,
      }),
    ).toThrowError("Service stock item quantity must be a finite number");
  });

  it("does not allow non-integer quantity", () => {
    expect(() => ServiceStockItemsRequired.create({ stockItemId: 1, quantity: 1.5 })).toThrowError(
      "Service stock item quantity must be an integer",
    );
  });

  it("does not allow zero or negative quantity", () => {
    expect(() => ServiceStockItemsRequired.create({ stockItemId: 1, quantity: 0 })).toThrowError(
      "Service stock item quantity must be greater than zero",
    );

    expect(() => ServiceStockItemsRequired.create({ stockItemId: 1, quantity: -1 })).toThrowError(
      "Service stock item quantity must be greater than zero",
    );
  });
});
