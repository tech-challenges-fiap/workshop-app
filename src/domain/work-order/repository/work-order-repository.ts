import type { WorkOrder } from "../aggregate/work-order";

export interface WorkOrderStatusDurationMetric {
  status: string;
  averageDurationSeconds: number;
  samples: number;
}

export interface WorkOrderRepository {
  create(workOrder: WorkOrder): Promise<WorkOrder>;
  findById(id: number): Promise<WorkOrder | null>;
  findByPublicToken(token: string): Promise<WorkOrder | null>;
  findAll(): Promise<WorkOrder[]>;
  listOperationalQueue(): Promise<WorkOrder[]>;
  getAverageDurationByStatus?(): Promise<WorkOrderStatusDurationMetric[]>;
  save(workOrder: WorkOrder): Promise<void>;
}
