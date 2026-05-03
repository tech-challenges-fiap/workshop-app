import { eq } from "drizzle-orm";

import { db } from "../db";
import { serviceTasks } from "../db/schema/service-task";
import { ServiceTask } from "../../domain/service-task/aggregate/service-task";
import type { ServiceTaskRepository } from "../../domain/service-task/repository/service-task-repository";
import { ServiceEstimatedTime } from "../../domain/service/value-object/service-estimated-time";
import { assertServiceTaskStatus } from "../../domain/service-task/value-object/service-task-status";
import { Money } from "../../domain/shared/value-object/money";

type QueryExecutor = Pick<typeof db, "insert" | "select" | "update" | "delete">;

type TimestampValue = Date | string | null;

type ServiceTaskRow = typeof serviceTasks.$inferSelect;

function toDate(value: TimestampValue): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  return new Date(value);
}

function mapToAggregate(params: { row: ServiceTaskRow }): ServiceTask {
  const status = assertServiceTaskStatus(params.row.status);
  const estimatedTime = ServiceEstimatedTime.createFromMinutes(params.row.estimatedTimeMinutes);

  return ServiceTask.rehydrate({
    id: params.row.id,
    serviceId: params.row.serviceId,
    workOrderId: params.row.workOrderId,
    status,
    estimatedTime,
    price: Money.create(Number(params.row.servicePrice)),
    startedAt: toDate(params.row.startedAt),
    completedAt: toDate(params.row.completedAt),
  });
}

export class ServiceTaskRepositoryPostgres implements ServiceTaskRepository {
  constructor(private readonly queryExecutor: QueryExecutor = db) {}

  public async create(serviceTask: ServiceTask): Promise<ServiceTask> {
    const snapshot = serviceTask.toSnapshot();
    const [row] = await this.queryExecutor
      .insert(serviceTasks)
      .values({
        serviceId: snapshot.serviceId,
        workOrderId: snapshot.workOrderId,
        status: snapshot.status,
        estimatedTimeMinutes: snapshot.estimatedTime,
        servicePrice: snapshot.price.toString(),
        startedAt: snapshot.startedAt ? new Date(snapshot.startedAt) : null,
        completedAt: snapshot.completedAt ? new Date(snapshot.completedAt) : null,
      })
      .returning();
    return mapToAggregate({ row });
  }

  public async findById(id: number): Promise<ServiceTask | null> {
    const [row] = await this.queryExecutor
      .select()
      .from(serviceTasks)
      .where(eq(serviceTasks.id, id));

    if (!row) {
      return null;
    }

    return mapToAggregate({ row });
  }

  public async findByServiceId(serviceId: number): Promise<ServiceTask[]> {
    const rows = await this.queryExecutor
      .select()
      .from(serviceTasks)
      .where(eq(serviceTasks.serviceId, serviceId));

    if (rows.length === 0) {
      return [];
    }

    return rows.map((row) => mapToAggregate({ row }));
  }

  public async findAll(): Promise<ServiceTask[]> {
    const rows = await this.queryExecutor.select().from(serviceTasks);

    if (rows.length === 0) {
      return [];
    }

    return rows.map((row) => mapToAggregate({ row }));
  }

  public async save(serviceTask: ServiceTask): Promise<void> {
    const snapshot = serviceTask.toSnapshot();

    if (snapshot.id === null) {
      throw new Error("Cannot save ServiceTask without an id");
    }

    const taskId = snapshot.id;

    await this.queryExecutor
      .update(serviceTasks)
      .set({
        status: snapshot.status,
        estimatedTimeMinutes: snapshot.estimatedTime,
        workOrderId: snapshot.workOrderId,
        servicePrice: snapshot.price.toString(),
        startedAt: snapshot.startedAt ? new Date(snapshot.startedAt) : null,
        completedAt: snapshot.completedAt ? new Date(snapshot.completedAt) : null,
      })
      .where(eq(serviceTasks.id, taskId));
  }
}
