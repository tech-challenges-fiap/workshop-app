import { describe, expect, it } from "bun:test";

import { StockItem } from "./stock-item";
import { StockItemName } from "../value-object/stock-item-name";
import { StockItemQuantity } from "../value-object/stock-item-quantity";
import { StockItemSku } from "../value-object/stock-item-sku";
import { InsufficientStock } from "../domain-error/insufficient-stock";
import { Money } from "../../shared/value-object/money";

describe("StockItem", () => {
  it("creates a stock item with initial quantity", () => {
    const sku = StockItemSku.create("BRAKE_PAD_001");
    const name = StockItemName.create("Oil Filter");
    const initialQuantity = StockItemQuantity.create(10);
    const price = Money.create(100);

    const item = StockItem.create({
      sku,
      name,
      description: "Oil filter for sedan",
      unitOfMeasure: "unit",
      initialQuantity,
      price,
    });

    const snapshot = item.toSnapshot();
    expect(snapshot).toEqual({
      id: null,
      sku: "BRAKE_PAD_001",
      name: "Oil Filter",
      description: "Oil filter for sedan",
      unitOfMeasure: "unit",
      quantity: 10,
      price: 100,
    });
  });

  it("increases quantity", () => {
    const item = StockItem.create({
      sku: StockItemSku.create("BRAKE_PAD_002"),
      name: StockItemName.create("Brake Pad"),
      price: Money.create(50),
    });

    item.increaseQuantity(StockItemQuantity.create(5));

    const snapshot = item.toSnapshot();
    expect(snapshot.quantity).toBe(5);
  });

  it("consumes quantity", () => {
    const item = StockItem.create({
      sku: StockItemSku.create("BRAKE_PAD_003"),
      name: StockItemName.create("Spark Plug"),
      initialQuantity: StockItemQuantity.create(8),
      price: Money.create(75),
    });

    item.consume(StockItemQuantity.create(3));

    const snapshot = item.toSnapshot();
    expect(snapshot.quantity).toBe(5);
  });

  it("does not allow consuming more than available quantity", () => {
    const item = StockItem.create({
      sku: StockItemSku.create("BRAKE_PAD_004"),
      name: StockItemName.create("Engine Oil"),
      initialQuantity: StockItemQuantity.create(2),
      price: Money.create(25.5),
    });

    expect(() => item.consume(StockItemQuantity.create(3))).toThrowError(InsufficientStock);

    const snapshot = item.toSnapshot();
    expect(snapshot.quantity).toBe(2);
  });

  it("rehydrates a stock item with id and quantity", () => {
    const id = 5;
    const sku = StockItemSku.create("BRAKE_PAD_005");
    const name = StockItemName.create("Clutch Kit");
    const quantity = StockItemQuantity.create(4);
    const price = Money.create(10);

    const item = StockItem.rehydrate({
      id,
      sku,
      name,
      description: "Clutch kit for hatchback",
      unitOfMeasure: "unit",
      quantity,
      price,
    });

    const snapshot = item.toSnapshot();
    expect(snapshot).toEqual({
      id: 5,
      sku: "BRAKE_PAD_005",
      name: "Clutch Kit",
      description: "Clutch kit for hatchback",
      unitOfMeasure: "unit",
      quantity: 4,
      price: 10,
    });
  });
});
