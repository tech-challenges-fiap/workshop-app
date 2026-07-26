import { describe, expect, it } from "bun:test";

import { buildInfrastructureDeps } from "./build-infrastructure";
import type { AppRuntimeConfig } from "./config";
import { StockItemRepositoryPostgres } from "../infrastructure/stock-item/stock-item-repository-postgres";
import { ServiceRepositoryPostgres } from "../infrastructure/service/service-repository-postgres";
import { ServiceTaskRepositoryPostgres } from "../infrastructure/service-task/service-task-repository-postgres";
import { VehicleRepositoryPostgres } from "../infrastructure/vehicle/vehicle-repository-postgres";
import { PersonRepositoryPostgres } from "../infrastructure/person/person-repository-postgres";
import { WorkOrderRepositoryPostgres } from "../infrastructure/work-order/work-order-repository-postgres";
import { WorkOrderWebhookEventRepositoryPostgres } from "../infrastructure/work-order/work-order-webhook-event-repository-postgres";
import { WorkOrderSagaRepositoryPostgres } from "../infrastructure/work-order/work-order-saga-repository-postgres";
import { BeeceptorNotification } from "../infrastructure/notification/beeceptor-notification";
import { NoopNotification } from "../infrastructure/notification/noop-notification";
import { NoopWorkOrderEventPublisher } from "../domain/work-order/events/work-order-event-publisher";

const TEST_CONFIG: AppRuntimeConfig = {
  adminUsername: "admin",
  adminPassword: "change-me",
  beeceptorNotificationUrl: "https://example.com/notify",
  appPort: 3000,
  jwtSecret: "secret",
  jwtIssuer: "workshop-edge",
  jwtAudience: "workshop-app",
  appEnv: "test",
  rabbitMqUrl: "",
  rabbitMqExchange: "workshop.os.events",
  rabbitMqWorkOrderEventsQueue: "workshop.os.work-order-events",
  rabbitMqSagaEventsQueue: "workshop.os.saga-events",
  rabbitMqConsumersEnabled: false,
};

describe("buildInfrastructureDeps", () => {
  it("builds repositories and integration with the expected concrete types", () => {
    const deps = buildInfrastructureDeps(TEST_CONFIG);

    expect(deps.stockItemRepository).toBeInstanceOf(StockItemRepositoryPostgres);
    expect(deps.serviceRepository).toBeInstanceOf(ServiceRepositoryPostgres);
    expect(deps.serviceTaskRepository).toBeInstanceOf(ServiceTaskRepositoryPostgres);
    expect(deps.vehicleRepository).toBeInstanceOf(VehicleRepositoryPostgres);
    expect(deps.personRepository).toBeInstanceOf(PersonRepositoryPostgres);
    expect(deps.workOrderRepository).toBeInstanceOf(WorkOrderRepositoryPostgres);
    expect(deps.workOrderWebhookEventRepository).toBeInstanceOf(
      WorkOrderWebhookEventRepositoryPostgres,
    );
    expect(deps.workOrderSagaRepository).toBeInstanceOf(WorkOrderSagaRepositoryPostgres);
    expect(deps.workOrderEventPublisher).toBeInstanceOf(NoopWorkOrderEventPublisher);
    expect(deps.notification).toBeInstanceOf(BeeceptorNotification);
  });

  it("passes notification endpoint from runtime config", () => {
    const deps = buildInfrastructureDeps(TEST_CONFIG);

    expect((deps.notification as unknown as { endpointUrl: string }).endpointUrl).toBe(
      TEST_CONFIG.beeceptorNotificationUrl,
    );
  });

  it("falls back to NoopNotification when endpoint is blank", () => {
    const deps = buildInfrastructureDeps({
      ...TEST_CONFIG,
      beeceptorNotificationUrl: "   ",
    });

    expect(deps.notification).toBeInstanceOf(NoopNotification);
  });
});
