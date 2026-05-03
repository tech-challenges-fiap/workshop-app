import { describe, expect, it } from "bun:test";

import { UpdateService } from "./update-service";
import type { ServiceRepository } from "../../domain/service/repository/service-repository";
import { Service } from "../../domain/service/aggregate/service";
import { ServiceName } from "../../domain/service/value-object/service-name";
import { ServiceEstimatedTime } from "../../domain/service/value-object/service-estimated-time";
import { ServiceNotFound } from "../../domain/service/domain-error/service-not-found";
import type { StockItemRepository } from "../../domain/stock-item/repository/stock-item-repository";
import type { StockItem } from "../../domain/stock-item/aggregate/stock-item";
import { StockItemNotFound } from "../../domain/stock-item/domain-error/stock-item-not-found";
import { Money } from "../../domain/shared/value-object/money";
import { InvalidServicePrice } from "../../domain/service/domain-error/invalid-service-price";

class InMemoryServiceRepositoryForUpdate implements ServiceRepository {
  constructor(private readonly existing: Service | null) {}

  public async create(): Promise<Service> {
    throw new Error("not used in this test");
  }

  public async findById(id: number): Promise<Service | null> {
    if (!this.existing) {
      return null;
    }

    const snapshot = this.existing.toSnapshot();

    if (snapshot.id !== id) {
      return null;
    }

    return this.existing;
  }

  public async findAll(): Promise<Service[]> {
    return [];
  }

  public async save(): Promise<void> {}

  public async delete(id: number): Promise<void> {
    void id;
  }
}

class InMemoryStockItemRepositoryForUpdate implements StockItemRepository {
  constructor(private readonly existingIds: Set<number>) {}

  public async create(): Promise<StockItem> {
    throw new Error("not used in this test");
  }

  public async findById(id: number): Promise<StockItem | null> {
    if (this.existingIds.has(id)) {
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

describe("UpdateService", () => {
  it("updates a service when requiredItems are provided", async () => {
    const existing = Service.rehydrate({
      id: 1,
      name: ServiceName.create("Basic"),
      estimatedTime: ServiceEstimatedTime.createFromMinutes(30),
      price: Money.create(100),
      requiredItems: [],
    });

    const repository = new InMemoryServiceRepositoryForUpdate(existing);
    const stockItemRepository = new InMemoryStockItemRepositoryForUpdate(new Set([1]));
    const useCase = new UpdateService(repository, stockItemRepository);

    const result = await useCase.execute({
      id: 1,
      name: "Updated with items",
      estimatedTime: 60,
      price: 150,
      requiredItems: [
        {
          stockItemId: 1,
          quantity: 2,
        },
      ],
    });

    expect(result).toMatchObject({
      id: 1,
      name: "Updated with items",
      estimatedTime: 60,
      price: 150,
      requiredItems: [
        {
          stockItemId: 1,
          quantity: 2,
        },
      ],
    });
  });

  it("updates a service when requiredItems is omitted", async () => {
    const existing = Service.rehydrate({
      id: 1,
      name: ServiceName.create("Basic"),
      estimatedTime: ServiceEstimatedTime.createFromMinutes(30),
      price: Money.create(80),
      requiredItems: [],
    });

    const repository = new InMemoryServiceRepositoryForUpdate(existing);
    const stockItemRepository = new InMemoryStockItemRepositoryForUpdate(new Set());
    const useCase = new UpdateService(repository, stockItemRepository);

    const result = await useCase.execute({
      id: 1,
      name: "Updated",
      estimatedTime: 45,
      price: 90,
    });

    expect(result).toMatchObject({
      id: 1,
      name: "Updated",
      estimatedTime: 45,
      price: 90,
      requiredItems: [],
    });
  });

  it("throws ServiceNotFound when service does not exist", async () => {
    const repository = new InMemoryServiceRepositoryForUpdate(null);
    const stockItemRepository = new InMemoryStockItemRepositoryForUpdate(new Set());
    const useCase = new UpdateService(repository, stockItemRepository);

    expect(
      useCase.execute({
        id: 1,
        name: "Updated",
        estimatedTime: 45,
        price: 50,
      }),
    ).rejects.toBeInstanceOf(ServiceNotFound);
  });

  it("throws StockItemNotFound when a required stock item does not exist", async () => {
    const existing = Service.rehydrate({
      id: 1,
      name: ServiceName.create("Basic"),
      estimatedTime: ServiceEstimatedTime.createFromMinutes(30),
      price: Money.create(70),
      requiredItems: [],
    });

    const serviceRepository = new InMemoryServiceRepositoryForUpdate(existing);
    const stockItemRepository = new InMemoryStockItemRepositoryForUpdate(new Set());
    const useCase = new UpdateService(serviceRepository, stockItemRepository);

    expect(
      useCase.execute({
        id: 1,
        name: "Updated with missing stock item",
        estimatedTime: 60,
        price: 100,
        requiredItems: [
          {
            stockItemId: 1,
            quantity: 2,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(StockItemNotFound);
  });

  it("throws InvalidServicePrice when price is invalid", async () => {
    const existing = Service.rehydrate({
      id: 1,
      name: ServiceName.create("Basic"),
      estimatedTime: ServiceEstimatedTime.createFromMinutes(30),
      price: Money.create(50),
      requiredItems: [],
    });

    const repository = new InMemoryServiceRepositoryForUpdate(existing);
    const stockItemRepository = new InMemoryStockItemRepositoryForUpdate(new Set());
    const useCase = new UpdateService(repository, stockItemRepository);

    expect(
      useCase.execute({
        id: 1,
        name: "Updated",
        estimatedTime: 45,
        price: -10,
      }),
    ).rejects.toBeInstanceOf(InvalidServicePrice);
  });

  it("updates a service when price has decimal places", async () => {
    const existing = Service.rehydrate({
      id: 1,
      name: ServiceName.create("Basic"),
      estimatedTime: ServiceEstimatedTime.createFromMinutes(30),
      price: Money.create(100.25),
      requiredItems: [],
    });

    const repository = new InMemoryServiceRepositoryForUpdate(existing);
    const stockItemRepository = new InMemoryStockItemRepositoryForUpdate(new Set());
    const useCase = new UpdateService(repository, stockItemRepository);

    const result = await useCase.execute({
      id: 1,
      name: "Updated decimal price",
      estimatedTime: 45,
      price: 150.75,
    });

    expect(result).toMatchObject({
      id: 1,
      name: "Updated decimal price",
      estimatedTime: 45,
      price: 150.75,
    });
  });
});
