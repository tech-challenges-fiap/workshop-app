import { asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "../db";
import { pool } from "../db";
import { workOrders } from "../db/schema/work-order";
import { serviceTasks } from "../db/schema/service-task";
import { workOrderStatusHistory } from "../db/schema/work-order-status-history";
import { WorkOrder } from "../../domain/work-order/aggregate/work-order";
import type {
  WorkOrderRepository,
  WorkOrderStatusDurationMetric,
} from "../../domain/work-order/repository/work-order-repository";
import {
  assertWorkOrderStatus,
  WorkOrderStatus,
} from "../../domain/work-order/value-object/work-order-status";
import { assertServiceTaskStatus } from "../../domain/service-task/value-object/service-task-status";
import { Money } from "../../domain/shared/value-object/money";

type QueryExecutor = Pick<typeof db, "insert" | "select" | "update" | "delete">;

type TimestampValue = Date | string | null;

type WorkOrderRow = typeof workOrders.$inferSelect;
type ServiceTaskRow = typeof serviceTasks.$inferSelect;

const OPERATIONAL_QUEUE_STATUSES = [
  WorkOrderStatus.IN_EXECUTION,
  WorkOrderStatus.WAITING_APPROVAL,
  WorkOrderStatus.DIAGNOSIS,
  WorkOrderStatus.RECEIVED,
] as const;

const OPERATIONAL_QUEUE_STATUS_ORDER_SQL = sql<number>`case
  when ${workOrders.status} = ${WorkOrderStatus.IN_EXECUTION} then 1
  when ${workOrders.status} = ${WorkOrderStatus.WAITING_APPROVAL} then 2
  when ${workOrders.status} = ${WorkOrderStatus.DIAGNOSIS} then 3
  when ${workOrders.status} = ${WorkOrderStatus.RECEIVED} then 4
  else 999
end`;

function toDate(value: TimestampValue): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  return new Date(value);
}

function mapToAggregate(params: { row: WorkOrderRow; tasks: ServiceTaskRow[] }): WorkOrder {
  const status = assertWorkOrderStatus(params.row.status);
  const totalAmount = Money.create(Number(params.row.totalAmount));
  const publicTokenExpiresAt = toDate(params.row.publicTokenExpiresAt);
  const createdAt = toDate(params.row.createdAt);
  const updatedAt = toDate(params.row.updatedAt);

  if (!publicTokenExpiresAt || !createdAt || !updatedAt) {
    throw new Error("Work order timestamps must be defined");
  }

  const tasks = params.tasks.map((task) => ({
    serviceTaskId: task.id,
    status: assertServiceTaskStatus(task.status),
    amount: Money.create(Number(task.servicePrice)),
  }));

  return WorkOrder.rehydrate({
    id: params.row.id,
    vehicleId: params.row.vehicleId,
    status,
    totalAmount,
    publicToken: params.row.publicToken,
    publicTokenExpiresAt,
    createdAt,
    updatedAt,
    serviceTasks: tasks,
  });
}

export class WorkOrderRepositoryPostgres implements WorkOrderRepository {
  constructor(private readonly queryExecutor: QueryExecutor = db) {}

  public async create(workOrder: WorkOrder): Promise<WorkOrder> {
    const snapshot = workOrder.toSnapshot();
    const [row] = await this.queryExecutor
      .insert(workOrders)
      .values({
        vehicleId: snapshot.vehicleId,
        status: snapshot.status,
        totalAmount: snapshot.totalAmount.toString(),
        publicToken: snapshot.publicToken,
        publicTokenExpiresAt: new Date(snapshot.publicTokenExpiresAt),
        createdAt: new Date(snapshot.createdAt),
        updatedAt: new Date(snapshot.updatedAt),
      })
      .returning();

    if (snapshot.serviceTasks.length > 0) {
      for (const task of snapshot.serviceTasks) {
        await this.queryExecutor
          .update(serviceTasks)
          .set({
            workOrderId: row.id,
            status: task.status,
            servicePrice: task.amount.toString(),
          })
          .where(eq(serviceTasks.id, task.serviceTaskId));
      }
    }

    await this.recordStatusHistory({
      workOrderId: row.id,
      fromStatus: null,
      toStatus: row.status,
      changedAt: row.createdAt ?? new Date(),
      reason: "created",
    });

    const tasks = await this.queryExecutor
      .select()
      .from(serviceTasks)
      .where(eq(serviceTasks.workOrderId, row.id));

    return mapToAggregate({ row, tasks });
  }

  public async findById(id: number): Promise<WorkOrder | null> {
    const [row] = await this.queryExecutor.select().from(workOrders).where(eq(workOrders.id, id));

    if (!row) {
      return null;
    }

    const taskRows = await this.queryExecutor
      .select()
      .from(serviceTasks)
      .where(eq(serviceTasks.workOrderId, row.id));

    return mapToAggregate({ row, tasks: taskRows });
  }

  public async findByPublicToken(token: string): Promise<WorkOrder | null> {
    const [row] = await this.queryExecutor
      .select()
      .from(workOrders)
      .where(eq(workOrders.publicToken, token));

    if (!row) {
      return null;
    }

    const taskRows = await this.queryExecutor
      .select()
      .from(serviceTasks)
      .where(eq(serviceTasks.workOrderId, row.id));

    return mapToAggregate({ row, tasks: taskRows });
  }

  public async findAll(): Promise<WorkOrder[]> {
    const rows = await this.queryExecutor.select().from(workOrders);

    if (rows.length === 0) {
      return [];
    }

    const ids = rows.map((row) => row.id);
    const taskRows = await this.queryExecutor
      .select()
      .from(serviceTasks)
      .where(inArray(serviceTasks.workOrderId, ids));

    const tasksByWorkOrderId = new Map<number, ServiceTaskRow[]>();
    for (const task of taskRows) {
      if (!task.workOrderId) {
        continue;
      }

      const list = tasksByWorkOrderId.get(task.workOrderId) ?? [];
      list.push(task);
      tasksByWorkOrderId.set(task.workOrderId, list);
    }

    return rows.map((row) =>
      mapToAggregate({
        row,
        tasks: tasksByWorkOrderId.get(row.id) ?? [],
      }),
    );
  }

  public async listOperationalQueue(): Promise<WorkOrder[]> {
    const rows = await this.queryExecutor
      .select()
      .from(workOrders)
      .where(inArray(workOrders.status, OPERATIONAL_QUEUE_STATUSES))
      .orderBy(OPERATIONAL_QUEUE_STATUS_ORDER_SQL, asc(workOrders.updatedAt), asc(workOrders.id));

    if (rows.length === 0) {
      return [];
    }

    const ids = rows.map((row) => row.id);
    const taskRows = await this.queryExecutor
      .select()
      .from(serviceTasks)
      .where(inArray(serviceTasks.workOrderId, ids));

    const tasksByWorkOrderId = new Map<number, ServiceTaskRow[]>();
    for (const task of taskRows) {
      if (!task.workOrderId) {
        continue;
      }

      const list = tasksByWorkOrderId.get(task.workOrderId) ?? [];
      list.push(task);
      tasksByWorkOrderId.set(task.workOrderId, list);
    }

    return rows.map((row) =>
      mapToAggregate({
        row,
        tasks: tasksByWorkOrderId.get(row.id) ?? [],
      }),
    );
  }

  public async save(workOrder: WorkOrder): Promise<void> {
    const snapshot = workOrder.toSnapshot();

    if (snapshot.id === null) {
      throw new Error("Cannot save WorkOrder without an id");
    }

    const [previousRow] = await this.queryExecutor
      .select()
      .from(workOrders)
      .where(eq(workOrders.id, snapshot.id));

    await this.queryExecutor
      .update(workOrders)
      .set({
        status: snapshot.status,
        totalAmount: snapshot.totalAmount.toString(),
        publicToken: snapshot.publicToken,
        publicTokenExpiresAt: new Date(snapshot.publicTokenExpiresAt),
        updatedAt: new Date(snapshot.updatedAt),
      })
      .where(eq(workOrders.id, snapshot.id));

    if (snapshot.serviceTasks.length > 0) {
      for (const task of snapshot.serviceTasks) {
        await this.queryExecutor
          .update(serviceTasks)
          .set({
            workOrderId: snapshot.id,
            status: task.status,
            servicePrice: task.amount.toString(),
          })
          .where(eq(serviceTasks.id, task.serviceTaskId));
      }
    }

    if (previousRow && previousRow.status !== String(snapshot.status)) {
      await this.recordStatusHistory({
        workOrderId: snapshot.id,
        fromStatus: previousRow.status,
        toStatus: snapshot.status,
        changedAt: new Date(snapshot.updatedAt),
        reason: "status-transition",
      });
    }
  }

  public async getAverageDurationByStatus(): Promise<WorkOrderStatusDurationMetric[]> {
    const result = await pool.query<{
      status: string;
      average_duration_seconds: string | null;
      samples: string;
    }>(`
      WITH ordered_history AS (
        SELECT
          work_order_id,
          to_status AS status,
          changed_at,
          LEAD(changed_at) OVER (
            PARTITION BY work_order_id
            ORDER BY changed_at ASC, id ASC
          ) AS next_changed_at
        FROM work_order_status_history
      )
      SELECT
        status,
        AVG(EXTRACT(EPOCH FROM (COALESCE(next_changed_at, NOW()) - changed_at))) AS average_duration_seconds,
        COUNT(*) AS samples
      FROM ordered_history
      GROUP BY status
      ORDER BY status ASC
    `);

    return result.rows.map((row) => ({
      status: row.status,
      averageDurationSeconds: Number(row.average_duration_seconds ?? 0),
      samples: Number(row.samples),
    }));
  }

  private async recordStatusHistory(params: {
    workOrderId: number;
    fromStatus: string | null;
    toStatus: string;
    changedAt: Date | string;
    reason: string;
  }): Promise<void> {
    await this.queryExecutor.insert(workOrderStatusHistory).values({
      workOrderId: params.workOrderId,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      changedAt: new Date(params.changedAt),
      reason: params.reason,
    });
  }
}
