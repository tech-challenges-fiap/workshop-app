import { describe, expect, it } from "bun:test";

import { StockItemName } from "./stock-item-name";

describe("StockItemName", () => {
  it("creates a valid name and trims it", () => {
    const name = StockItemName.create("  Oil Filter  ");
    expect(name.toString()).toBe("Oil Filter");
  });

  it("does not allow empty name", () => {
    expect(() => StockItemName.create("   ")).toThrowError("Stock item name must not be empty");
  });

  it("does not allow name longer than 255 characters", () => {
    const longName = "x".repeat(256);
    expect(() => StockItemName.create(longName)).toThrowError(
      "Stock item name must be at most 255 characters long",
    );
  });
});
