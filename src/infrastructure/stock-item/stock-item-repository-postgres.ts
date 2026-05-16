import { eq } from "drizzle-orm";

import { db } from "../db";
import { stockItems } from "../db/schema/stock-item";
import { SkuAlreadyExists } from "../../domain/stock-item/domain-error/sku-already-exists";
import { StockItem } from "../../domain/stock-item/aggregate/stock-item";
import { StockItemName } from "../../domain/stock-item/value-object/stock-item-name";
import { StockItemQuantity } from "../../domain/stock-item/value-object/stock-item-quantity";
import { StockItemSku } from "../../domain/stock-item/value-object/stock-item-sku";
import type { StockItemRepository } from "../../domain/stock-item/repository/stock-item-repository";
import { Money } from "../../domain/shared/value-object/money";

type QueryExecutor = Pick<typeof db, "insert" | "select" | "update" | "delete">;

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as { code?: unknown; cause?: unknown };

  if (candidate.code === "23505") {
    return true;
  }

  if (candidate.cause && typeof candidate.cause === "object") {
    const causeWithCode = candidate.cause as { code?: unknown };
    if (causeWithCode.code === "23505") {
      return true;
    }
  }

  return false;
}

export class StockItemRepositoryPostgres implements StockItemRepository {
  constructor(private readonly queryExecutor: QueryExecutor = db) {}

  public async create(stockItem: StockItem): Promise<StockItem> {
    const snapshot = stockItem.toSnapshot();

    try {
      const [row] = await this.queryExecutor
        .insert(stockItems)
        .values({
          sku: snapshot.sku,
          name: snapshot.name,
          description: snapshot.description,
          unitOfMeasure: snapshot.unitOfMeasure,
          quantity: snapshot.quantity,
          price: snapshot.price.toString(),
        })
        .returning();

      const name = StockItemName.create(row.name);
      const quantity = StockItemQuantity.create(row.quantity);
      const stockItemSku = StockItemSku.create(row.sku);
      const price = Money.create(Number(row.price));

      return StockItem.rehydrate({
        id: row.id,
        sku: stockItemSku,
        name,
        description: row.description ?? null,
        unitOfMeasure: row.unitOfMeasure ?? null,
        quantity,
        price,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new SkuAlreadyExists(snapshot.sku);
      }

      throw error;
    }
  }

  public async findById(id: number): Promise<StockItem | null> {
    const [row] = await this.queryExecutor.select().from(stockItems).where(eq(stockItems.id, id));

    if (!row) {
      return null;
    }

    const name = StockItemName.create(row.name);
    const quantity = StockItemQuantity.create(row.quantity);
    const stockItemSku = StockItemSku.create(row.sku);
    const price = Money.create(Number(row.price));

    return StockItem.rehydrate({
      id: row.id,
      sku: stockItemSku,
      name,
      description: row.description ?? null,
      unitOfMeasure: row.unitOfMeasure ?? null,
      quantity,
      price,
    });
  }

  public async findAll(): Promise<StockItem[]> {
    const rows = await this.queryExecutor.select().from(stockItems);

    return rows.map((row) => {
      const name = StockItemName.create(row.name);
      const quantity = StockItemQuantity.create(row.quantity);
      const stockItemSku = StockItemSku.create(row.sku);
      const price = Money.create(Number(row.price));

      return StockItem.rehydrate({
        id: row.id,
        sku: stockItemSku,
        name,
        description: row.description ?? null,
        unitOfMeasure: row.unitOfMeasure ?? null,
        quantity,
        price,
      });
    });
  }

  public async save(stockItem: StockItem): Promise<void> {
    const snapshot = stockItem.toSnapshot();

    if (!snapshot.id) {
      throw new Error("Cannot save StockItem without an id");
    }

    await this.queryExecutor
      .update(stockItems)
      .set({
        name: snapshot.name,
        description: snapshot.description,
        unitOfMeasure: snapshot.unitOfMeasure,
        quantity: snapshot.quantity,
        price: snapshot.price.toString(),
      })
      .where(eq(stockItems.id, snapshot.id));
  }

  public async delete(id: number): Promise<void> {
    await this.queryExecutor.delete(stockItems).where(eq(stockItems.id, id));
  }
}
