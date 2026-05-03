import type { Hono } from "hono";

import type { CreateWorkOrderWithFullPayload } from "../../application/work-order/create-work-order-with-full-payload";
import type { GetWorkOrderById } from "../../application/work-order/get-work-order-by-id";
import type { ListWorkOrders } from "../../application/work-order/list-work-orders";
import type { CancelWorkOrder } from "../../application/work-order/cancel-work-order";
import type { DeliverVehicle } from "../../application/work-order/deliver-vehicle";
import type { GetWorkOrderByPublicToken } from "../../application/work-order/get-work-order-by-public-token";
import type { StartDiagnosis } from "../../application/work-order/start-diagnosis";
import type { CompleteDiagnosis } from "../../application/work-order/complete-diagnosis";
import type { GetWorkOrderStatusDurationMetrics } from "../../application/work-order/get-work-order-status-duration-metrics";
import { registerAdminWorkOrderRoutes } from "./admin-routes";
import { registerPublicWorkOrderRoutes } from "./public-routes";

export interface WorkOrderRouteDependencies {
  createWorkOrder: CreateWorkOrderWithFullPayload;
  getWorkOrderById: GetWorkOrderById;
  listWorkOrders: ListWorkOrders;
  cancelWorkOrder: CancelWorkOrder;
  deliverVehicle: DeliverVehicle;
  getWorkOrderByPublicToken: GetWorkOrderByPublicToken;
  startDiagnosis?: StartDiagnosis;
  completeDiagnosis?: CompleteDiagnosis;
  getStatusDurationMetrics?: GetWorkOrderStatusDurationMetrics;
}

export function registerWorkOrderRoutes(app: Hono, deps: WorkOrderRouteDependencies): void {
  registerAdminWorkOrderRoutes(app, deps);
  registerPublicWorkOrderRoutes(app, deps);
}
