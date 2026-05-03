import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { services, serviceRequiredStockItems } from "../db/schema/service";
import { Service } from "../../domain/service/aggregate/service";
import { ServiceName } from "../../domain/service/value-object/service-name";
import { ServiceEstimatedTime } from "../../domain/service/value-object/service-estimated-time";
import { ServiceStockItemsRequired } from "../../domain/service/value-object/service-stock-item-reference";
import { Money } from "../../domain/shared/value-object/money";
import type { ServiceRepository } from "../../domain/service/repository/service-repository";

type QueryExecutor = Pick<typeof db, "insert" | "select" | "update" | "delete">;

export class ServiceRepositoryPostgres implements ServiceRepository {
  constructor(private readonly queryExecutor: QueryExecutor = db) {}

  public async create(service: Service): Promise<Service> {
    const snapshot = service.toSnapshot();
    const [inserted] = await this.queryExecutor
      .insert(services)
      .values({
        name: snapshot.name,
        estimatedTimeMinutes: snapshot.estimatedTime,
        price: snapshot.price.toString(),
      })
      .returning();

    if (snapshot.requiredItems.length > 0) {
      await this.queryExecutor.insert(serviceRequiredStockItems).values(
        snapshot.requiredItems.map((item) => ({
          serviceId: inserted.id,
          stockItemId: item.stockItemId,
          quantity: item.quantity,
        })),
      );
    }

    const name = ServiceName.create(inserted.name);
    const estimatedTime = ServiceEstimatedTime.createFromMinutes(inserted.estimatedTimeMinutes);
    const price = Money.create(Number(inserted.price));
    const requiredItems = (snapshot.requiredItems ?? []).map((item) =>
      ServiceStockItemsRequired.create({
        stockItemId: item.stockItemId,
        quantity: item.quantity,
      }),
    );

    return Service.rehydrate({
      id: inserted.id,
      name,
      estimatedTime,
      price,
      requiredItems,
    });
  }

  public async findById(id: number): Promise<Service | null> {
    const [row] = await this.queryExecutor.select().from(services).where(eq(services.id, id));
    if (!row) return null;

    const stockItemsRows = await this.queryExecutor
      .select()
      .from(serviceRequiredStockItems)
      .where(eq(serviceRequiredStockItems.serviceId, row.id));

    const name = ServiceName.create(row.name);
    const estimatedTime = ServiceEstimatedTime.createFromMinutes(row.estimatedTimeMinutes);
    const price = Money.create(Number(row.price));
    const requiredItems = stockItemsRows.map((item) =>
      ServiceStockItemsRequired.create({
        stockItemId: item.stockItemId,
        quantity: item.quantity,
      }),
    );

    return Service.rehydrate({
      id: row.id,
      name,
      estimatedTime,
      price,
      requiredItems,
    });
  }

  public async findAll(): Promise<Service[]> {
    const serviceRows = await this.queryExecutor.select().from(services);
    if (serviceRows.length === 0) return [];
    const ids = serviceRows.map((row) => row.id);

    const stockItemsRows = await this.queryExecutor
      .select()
      .from(serviceRequiredStockItems)
      .where(inArray(serviceRequiredStockItems.serviceId, ids));

    const stockItemsByServiceId = new Map<number, typeof stockItemsRows>();
    for (const row of stockItemsRows) {
      const list = stockItemsByServiceId.get(row.serviceId) ?? [];
      list.push(row);
      stockItemsByServiceId.set(row.serviceId, list);
    }

    return serviceRows.map((row) => {
      const relatedStockItems = stockItemsByServiceId.get(row.id) ?? [];
      const name = ServiceName.create(row.name);
      const estimatedTime = ServiceEstimatedTime.createFromMinutes(row.estimatedTimeMinutes);
      const price = Money.create(Number(row.price));
      const requiredItems = relatedStockItems.map((item) =>
        ServiceStockItemsRequired.create({
          stockItemId: item.stockItemId,
          quantity: item.quantity,
        }),
      );
      return Service.rehydrate({
        id: row.id,
        name,
        estimatedTime,
        price,
        requiredItems,
      });
    });
  }

  public async save(service: Service): Promise<void> {
    const snapshot = service.toSnapshot();
    if (!snapshot.id) throw new Error("Cannot save Service without an id");

    await this.queryExecutor
      .update(services)
      .set({
        name: snapshot.name,
        estimatedTimeMinutes: snapshot.estimatedTime,
        price: snapshot.price.toString(),
      })
      .where(eq(services.id, snapshot.id));

    await this.queryExecutor
      .delete(serviceRequiredStockItems)
      .where(eq(serviceRequiredStockItems.serviceId, snapshot.id));

    if (snapshot.requiredItems.length > 0) {
      await this.queryExecutor.insert(serviceRequiredStockItems).values(
        snapshot.requiredItems.map((item) => ({
          serviceId: snapshot.id!,
          stockItemId: item.stockItemId,
          quantity: item.quantity,
        })),
      );
    }
  }

  public async delete(id: number): Promise<void> {
    await this.queryExecutor.delete(services).where(eq(services.id, id));
  }
}
