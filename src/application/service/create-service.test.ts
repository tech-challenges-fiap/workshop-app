import { describe, expect, it } from "bun:test";

import { CreateService } from "./create-service";
import type { ServiceRepository } from "../../domain/service/repository/service-repository";
import { Service } from "../../domain/service/aggregate/service";
import { ServiceName } from "../../domain/service/value-object/service-name";
import { ServiceEstimatedTime } from "../../domain/service/value-object/service-estimated-time";
import { ServiceStockItemsRequired } from "../../domain/service/value-object/service-stock-item-reference";
import type { StockItemRepository } from "../../domain/stock-item/repository/stock-item-repository";
import type { StockItem } from "../../domain/stock-item/aggregate/stock-item";
import { StockItemNotFound } from "../../domain/stock-item/domain-error/stock-item-not-found";
import { Money } from "../../domain/shared/value-object/money";
import { InvalidServicePrice } from "../../domain/service/domain-error/invalid-service-price";

class InMemoryServiceRepositoryForCreate implements ServiceRepository {
  public lastCreated: Service | null = null;

  public async create(service: Service): Promise<Service> {
    const snapshot = service.toSnapshot();
    const id = 1;

    const requiredItems = snapshot.requiredItems.map((item) =>
      ServiceStockItemsRequired.create({
        stockItemId: item.stockItemId,
        quantity: item.quantity,
      }),
    );

    const created = Service.rehydrate({
      id,
      name: ServiceName.create(snapshot.name),
      estimatedTime: ServiceEstimatedTime.createFromMinutes(snapshot.estimatedTime),
      price: Money.create(snapshot.price),
      requiredItems,
    });

    this.lastCreated = created;
    return created;
  }

  public async findById(): Promise<Service | null> {
    return null;
  }

  public async findAll(): Promise<Service[]> {
    return [];
  }

  public async save(): Promise<void> {}

  public async delete(id: number): Promise<void> {
    void id;
  }
}

class FakeStockItemRepositoryForCreate implements StockItemRepository {
  public existingIds = new Set<string>();

  public async create(): Promise<StockItem> {
    throw new Error("Not implemented");
  }

  public async findById(id: number): Promise<StockItem | null> {
    if (this.existingIds.has(id.toString())) {
      return {} as StockItem;
    }

    return null;
  }

  public async save(): Promise<void> {}

  public async findAll(): Promise<StockItem[]> {
    return [];
  }

  public async delete(id: number): Promise<void> {
    void id;
  }
}

describe("CreateService", () => {
  it("creates a service when requiredItems is omitted", async () => {
    const repository = new InMemoryServiceRepositoryForCreate();
    const stockItemRepository = new FakeStockItemRepositoryForCreate();
    const useCase = new CreateService(repository, stockItemRepository);

    const result = await useCase.execute({
      name: "Alignment",
      estimatedTime: 60,
      price: 100,
    });

    expect(result).toMatchObject({
      name: "Alignment",
      estimatedTime: 60,
      price: 100,
      requiredItems: [],
    });
  });

  it("creates a service when requiredItems is provided", async () => {
    const repository = new InMemoryServiceRepositoryForCreate();
    const stockItemRepository = new FakeStockItemRepositoryForCreate();
    stockItemRepository.existingIds.add("1");
    stockItemRepository.existingIds.add("2");
    const useCase = new CreateService(repository, stockItemRepository);

    const result = await useCase.execute({
      name: "Oil change",
      estimatedTime: 30,
      price: 200,
      requiredItems: [
        {
          stockItemId: 1,
          quantity: 2,
        },
        {
          stockItemId: 2,
          quantity: 1,
        },
      ],
    });

    expect(result).toMatchObject({
      name: "Oil change",
      estimatedTime: 30,
      price: 200,
      requiredItems: [
        {
          stockItemId: 1,
          quantity: 2,
        },
        {
          stockItemId: 2,
          quantity: 1,
        },
      ],
    });
  });

  it("throws when a required stock item does not exist", async () => {
    const repository = new InMemoryServiceRepositoryForCreate();
    const stockItemRepository = new FakeStockItemRepositoryForCreate();
    const useCase = new CreateService(repository, stockItemRepository);

    expect(
      useCase.execute({
        name: "Oil change",
        estimatedTime: 30,
        price: 50,
        requiredItems: [
          {
            stockItemId: 999,
            quantity: 1,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(StockItemNotFound);
  });

  it("throws InvalidServicePrice when price is invalid", async () => {
    const repository = new InMemoryServiceRepositoryForCreate();
    const stockItemRepository = new FakeStockItemRepositoryForCreate();
    const useCase = new CreateService(repository, stockItemRepository);

    expect(
      useCase.execute({
        name: "Invalid Price Service",
        estimatedTime: 30,
        price: -10,
      }),
    ).rejects.toBeInstanceOf(InvalidServicePrice);
  });

  it("creates a service when price has decimal places", async () => {
    const repository = new InMemoryServiceRepositoryForCreate();
    const stockItemRepository = new FakeStockItemRepositoryForCreate();
    const useCase = new CreateService(repository, stockItemRepository);

    const result = await useCase.execute({
      name: "Wheel Balance",
      estimatedTime: 40,
      price: 199.9,
    });

    expect(result).toMatchObject({
      name: "Wheel Balance",
      estimatedTime: 40,
      price: 199.9,
    });
  });
});
