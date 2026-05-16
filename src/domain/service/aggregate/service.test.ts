import { describe, expect, it } from "bun:test";

import { Service } from "./service";
import { ServiceName } from "../value-object/service-name";
import { ServiceEstimatedTime } from "../value-object/service-estimated-time";
import { ServiceStockItemsRequired } from "../value-object/service-stock-item-reference";
import { Money } from "../../shared/value-object/money";

describe("Service", () => {
  it("creates a service with required items and returns a snapshot", () => {
    const name = ServiceName.create("Brake Inspection");
    const estimatedTime = ServiceEstimatedTime.createFromMinutes(90);
    const price = Money.create(150);
    const requiredItems = [
      ServiceStockItemsRequired.create({
        stockItemId: 1,
        quantity: 2,
      }),
    ];

    const service = Service.create({
      name,
      estimatedTime,
      price,
      requiredItems,
    });
    const snapshot = service.toSnapshot();

    expect(snapshot.id).toBeNull();
    expect(snapshot).toMatchObject({
      name: "Brake Inspection",
      estimatedTime: 90,
      price: 150,
      requiredItems: [
        {
          stockItemId: 1,
          quantity: 2,
        },
      ],
    });
  });

  it("creates a service without required items and defaults to an empty list", () => {
    const name = ServiceName.create("Quick Check");
    const estimatedTime = ServiceEstimatedTime.createFromMinutes(15);
    const price = Money.create(50);

    const service = Service.create({ name, estimatedTime, price });
    const snapshot = service.toSnapshot();

    expect(snapshot.requiredItems).toEqual([]);
  });

  it("rehydrates an existing service and updates its details", () => {
    const id = 1;
    const name = ServiceName.create("Oil Change");
    const estimatedTime = ServiceEstimatedTime.createFromMinutes(45);
    const price = Money.create(80);

    const service = Service.rehydrate({
      id,
      name,
      estimatedTime,
      price,
      requiredItems: [],
    });

    const newName = ServiceName.create("Premium Oil Change");
    const newEstimatedTime = ServiceEstimatedTime.createFromMinutes(60);
    const newPrice = Money.create(120);
    const newRequiredItems = [
      ServiceStockItemsRequired.create({
        stockItemId: 2,
        quantity: 1,
      }),
    ];

    service.updateDetails({
      name: newName,
      estimatedTime: newEstimatedTime,
      price: newPrice,
      requiredItems: newRequiredItems,
    });

    const snapshot = service.toSnapshot();

    expect(snapshot.id).toBe(id);
    expect(snapshot).toMatchObject({
      name: "Premium Oil Change",
      estimatedTime: 60,
      price: 120,
      requiredItems: [
        {
          stockItemId: 2,
          quantity: 1,
        },
      ],
    });
  });

  it("calculates full price including required stock items", () => {
    const name = ServiceName.create("Engine Service");
    const estimatedTime = ServiceEstimatedTime.createFromMinutes(120);
    const servicePrice = Money.create(200);

    const requiredItems = [
      ServiceStockItemsRequired.create({ stockItemId: 1, quantity: 2 }),
      ServiceStockItemsRequired.create({ stockItemId: 2, quantity: 1 }),
    ];

    const service = Service.create({
      name,
      estimatedTime,
      price: servicePrice,
      requiredItems,
    });

    const stockItemPrices = [
      { stockItemId: 1, price: Money.create(50) },
      { stockItemId: 2, price: Money.create(100) },
    ];

    const fullPrice = service.calculateFullPrice(stockItemPrices);

    // Base 200 + (2 * 50) + (1 * 100) = 400
    expect(fullPrice.toNumber()).toBe(400);
  });

  it("throws when a required stock item price is missing", () => {
    const name = ServiceName.create("Engine Service");
    const estimatedTime = ServiceEstimatedTime.createFromMinutes(120);
    const servicePrice = Money.create(200);

    const requiredItems = [
      ServiceStockItemsRequired.create({ stockItemId: 1, quantity: 2 }),
      ServiceStockItemsRequired.create({ stockItemId: 2, quantity: 1 }),
    ];

    const service = Service.create({
      name,
      estimatedTime,
      price: servicePrice,
      requiredItems,
    });

    const stockItemPrices = [{ stockItemId: 1, price: Money.create(50) }];

    expect(() => service.calculateFullPrice(stockItemPrices)).toThrow(
      "Missing price for stock item 2",
    );
  });
});
