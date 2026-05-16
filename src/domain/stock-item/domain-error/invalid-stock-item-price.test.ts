import { describe, expect, it } from "bun:test";

import { InvalidStockItemPrice } from "./invalid-stock-item-price";

describe("InvalidStockItemPrice", () => {
  it("sets name and message correctly", () => {
    const error = new InvalidStockItemPrice(-10);

    expect(error.name).toBe("InvalidStockItemPrice");
    expect(error.message).toBe("Invalid stock item price: '-10'");
    expect(error.value).toBe(-10);
  });
});
