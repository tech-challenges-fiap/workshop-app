import type { AppRuntimeConfig } from "./config";
import { StockItemRepositoryPostgres } from "../infrastructure/stock-item/stock-item-repository-postgres";
import { ServiceRepositoryPostgres } from "../infrastructure/service/service-repository-postgres";
import { ServiceTaskRepositoryPostgres } from "../infrastructure/service-task/service-task-repository-postgres";
import { VehicleRepositoryPostgres } from "../infrastructure/vehicle/vehicle-repository-postgres";
import { PersonRepositoryPostgres } from "../infrastructure/person/person-repository-postgres";
import { WorkOrderRepositoryPostgres } from "../infrastructure/work-order/work-order-repository-postgres";
import { WorkOrderWebhookEventRepositoryPostgres } from "../infrastructure/work-order/work-order-webhook-event-repository-postgres";
import { BeeceptorNotification } from "../infrastructure/notification/beeceptor-notification";
import { NoopNotification } from "../infrastructure/notification/noop-notification";
import type { Notification } from "../application/notification/notification";

export interface InfrastructureDeps {
  stockItemRepository: StockItemRepositoryPostgres;
  serviceRepository: ServiceRepositoryPostgres;
  serviceTaskRepository: ServiceTaskRepositoryPostgres;
  vehicleRepository: VehicleRepositoryPostgres;
  personRepository: PersonRepositoryPostgres;
  workOrderRepository: WorkOrderRepositoryPostgres;
  workOrderWebhookEventRepository: WorkOrderWebhookEventRepositoryPostgres;
  notification: Notification;
}

export function buildInfrastructureDeps(config: AppRuntimeConfig): InfrastructureDeps {
  const notificationUrl = config.beeceptorNotificationUrl.trim();

  return {
    stockItemRepository: new StockItemRepositoryPostgres(),
    serviceRepository: new ServiceRepositoryPostgres(),
    serviceTaskRepository: new ServiceTaskRepositoryPostgres(),
    vehicleRepository: new VehicleRepositoryPostgres(),
    personRepository: new PersonRepositoryPostgres(),
    workOrderRepository: new WorkOrderRepositoryPostgres(),
    workOrderWebhookEventRepository: new WorkOrderWebhookEventRepositoryPostgres(),
    notification:
      notificationUrl.length > 0
        ? new BeeceptorNotification(notificationUrl)
        : new NoopNotification(),
  };
}
