import { describe, expect, it } from "bun:test";

import { DeleteStockItem } from "./delete-stock-item";
import { GetStockItemById } from "./get-stock-item-by-id";
import { ListStockItems } from "./list-stock-items";
import { UpdateStockItem } from "./update-stock-item";
import type { StockItemRepository } from "../../domain/stock-item/repository/stock-item-repository";
import { StockItem } from "../../domain/stock-item/aggregate/stock-item";
import { StockItemSku } from "../../domain/stock-item/value-object/stock-item-sku";
import { StockItemName } from "../../domain/stock-item/value-object/stock-item-name";
import { StockItemQuantity } from "../../domain/stock-item/value-object/stock-item-quantity";
import { Money } from "../../domain/shared/value-object/money";
import { StockItemNotFound } from "../../domain/stock-item/domain-error/stock-item-not-found";
import { InvalidStockItemPrice } from "../../domain/stock-item/domain-error/invalid-stock-item-price";

class InMemoryStockItemRepository implements StockItemRepository {
  private readonly items = new Map<number, StockItem>();

  public async create(): Promise<StockItem> {
    throw new Error("Not implemented");
  }

  public async findById(id: number): Promise<StockItem | null> {
    return this.items.get(id) ?? null;
  }

  public async findAll(): Promise<StockItem[]> {
    return Array.from(this.items.values());
  }

  public async save(stockItem: StockItem): Promise<void> {
    const snapshot = stockItem.toSnapshot();

    if (!snapshot.id) {
      throw new Error("Stock item must have an id to be saved");
    }

    this.items.set(snapshot.id, stockItem);
  }

  public async delete(id: number): Promise<void> {
    this.items.delete(id);
  }

  public set(id: number, stockItem: StockItem): void {
    this.items.set(id, stockItem);
  }
}

function makeStockItem(params: {
  id: number;
  sku?: string;
  name?: string;
  description?: string | null;
  unitOfMeasure?: string | null;
  quantity?: number;
  price?: number;
}): StockItem {
  const sku = StockItemSku.create(params.sku ?? "SKU-1");
  const name = StockItemName.create(params.name ?? "Item 1");
  const quantity = StockItemQuantity.create(params.quantity ?? 0);
  const price = Money.create(params.price ?? 10);

  return StockItem.rehydrate({
    id: params.id,
    sku,
    name,
    description: params.description ?? null,
    unitOfMeasure: params.unitOfMeasure ?? null,
    quantity,
    price,
  });
}

describe("DeleteStockItem", () => {
  it("deletes an existing stock item", async () => {
    const repository = new InMemoryStockItemRepository();
    const item = makeStockItem({ id: 1 });
    repository.set(1, item);
    const useCase = new DeleteStockItem(repository);

    await useCase.execute({ id: 1 });

    const found = await repository.findById(1);
    expect(found).toBeNull();
  });

  it("throws StockItemNotFound when the item does not exist", async () => {
    const repository = new InMemoryStockItemRepository();
    const useCase = new DeleteStockItem(repository);

    expect(useCase.execute({ id: 999 })).rejects.toBeInstanceOf(StockItemNotFound);
  });
});

describe("GetStockItemById", () => {
  it("returns the stock item snapshot when it exists", async () => {
    const repository = new InMemoryStockItemRepository();
    const item = makeStockItem({ id: 1, name: "Oil" });
    repository.set(1, item);
    const useCase = new GetStockItemById(repository);

    const result = await useCase.execute({ id: 1 });

    expect(result).toMatchObject({
      id: 1,
      name: "Oil",
    });
  });

  it("throws StockItemNotFound when the item does not exist", async () => {
    const repository = new InMemoryStockItemRepository();
    const useCase = new GetStockItemById(repository);

    expect(useCase.execute({ id: 123 })).rejects.toBeInstanceOf(StockItemNotFound);
  });
});

describe("ListStockItems", () => {
  it("returns all stock items as snapshots", async () => {
    const repository = new InMemoryStockItemRepository();
    repository.set(1, makeStockItem({ id: 1, name: "Oil" }));
    repository.set(2, makeStockItem({ id: 2, name: "Filter" }));
    const useCase = new ListStockItems(repository);

    const result = await useCase.execute();

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.name)).toEqual(["Oil", "Filter"]);
  });

  it("returns an empty list when there are no items", async () => {
    const repository = new InMemoryStockItemRepository();
    const useCase = new ListStockItems(repository);

    const result = await useCase.execute();

    expect(result).toEqual([]);
  });
});

describe("UpdateStockItem", () => {
  it("updates mutable fields of an existing stock item", async () => {
    const repository = new InMemoryStockItemRepository();
    const existing = makeStockItem({
      id: 1,
      name: "Old name",
      description: "Old description",
      unitOfMeasure: "unit",
      quantity: 5,
      price: 10,
    });
    repository.set(1, existing);
    const useCase = new UpdateStockItem(repository);

    const updated = await useCase.execute({
      id: 1,
      name: "New name",
      description: "New description",
      unitOfMeasure: "new-unit",
      price: 20,
    });

    expect(updated).toMatchObject({
      id: 1,
      name: "New name",
      description: "New description",
      unitOfMeasure: "new-unit",
      price: 20,
      quantity: 5,
    });

    const persisted = await repository.findById(1);
    expect(persisted?.toSnapshot()).toMatchObject(updated);
  });

  it("throws StockItemNotFound when trying to update a non-existing item", async () => {
    const repository = new InMemoryStockItemRepository();
    const useCase = new UpdateStockItem(repository);

    expect(
      useCase.execute({
        id: 999,
        name: "Does not matter",
      }),
    ).rejects.toBeInstanceOf(StockItemNotFound);
  });

  it("throws InvalidStockItemPrice when price is invalid", async () => {
    const repository = new InMemoryStockItemRepository();
    const existing = makeStockItem({ id: 1, price: 10 });
    repository.set(1, existing);
    const useCase = new UpdateStockItem(repository);

    expect(
      useCase.execute({
        id: 1,
        price: -5,
      }),
    ).rejects.toBeInstanceOf(InvalidStockItemPrice);
  });
});
