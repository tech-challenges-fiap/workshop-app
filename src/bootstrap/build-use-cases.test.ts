import { describe, expect, it } from "bun:test";

import { buildInfrastructureDeps } from "./build-infrastructure";
import { buildApplicationDeps } from "./build-use-cases";
import type { AppRuntimeConfig } from "./config";
import { LoginAdmin } from "../application/auth/login-admin";
import { CreateStockItem } from "../application/stock-item/create-stock-item";
import { CreateService } from "../application/service/create-service";
import { AddServiceTask } from "../application/service-task/add-service-task";
import { CreateVehicle } from "../application/vehicle/create-vehicle";
import { CreatePerson } from "../application/person/create-person";
import { CreateWorkOrderWithFullPayload } from "../application/work-order/create-work-order-with-full-payload";
import { CompleteDiagnosis } from "../application/work-order/complete-diagnosis";
import { CompleteServiceTask } from "../application/service-task/complete-service-task";
import { HandleExternalWorkOrderEvent } from "../application/work-order/handle-external-work-order-event";
import { HandleInboundWorkOrderSagaEvent } from "../application/work-order/handle-inbound-work-order-saga-event";
import { OrchestrateWorkOrderSaga } from "../application/work-order/orchestrate-work-order-saga";

const TEST_CONFIG: AppRuntimeConfig = {
  adminUsername: "test-admin",
  adminPassword: "test-password",
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

describe("buildApplicationDeps", () => {
  it("builds use cases grouped by context", () => {
    const infra = buildInfrastructureDeps(TEST_CONFIG);
    const deps = buildApplicationDeps(infra, TEST_CONFIG);

    expect(deps.auth.loginAdmin).toBeInstanceOf(LoginAdmin);
    expect(deps.stockItems.createStockItem).toBeInstanceOf(CreateStockItem);
    expect(deps.services.createService).toBeInstanceOf(CreateService);
    expect(deps.serviceTasks.addServiceTask).toBeInstanceOf(AddServiceTask);
    expect(deps.vehicles.createVehicle).toBeInstanceOf(CreateVehicle);
    expect(deps.person.createPerson).toBeInstanceOf(CreatePerson);
    expect(deps.workOrders.createWorkOrder).toBeInstanceOf(CreateWorkOrderWithFullPayload);
    expect(deps.workOrders.orchestrateSaga).toBeInstanceOf(OrchestrateWorkOrderSaga);
    expect(deps.workOrders.handleInboundSagaEvent).toBeInstanceOf(HandleInboundWorkOrderSagaEvent);
    expect(deps.webhooks.handleExternalWorkOrderEvent).toBeInstanceOf(HandleExternalWorkOrderEvent);
  });

  it("uses required constructor inputs and preserves shared dependency instances", () => {
    const infra = buildInfrastructureDeps(TEST_CONFIG);
    const deps = buildApplicationDeps(infra, TEST_CONFIG);

    expect((deps.auth.loginAdmin as unknown as { adminUsername: string }).adminUsername).toBe(
      TEST_CONFIG.adminUsername,
    );
    expect((deps.auth.loginAdmin as unknown as { adminPassword: string }).adminPassword).toBe(
      TEST_CONFIG.adminPassword,
    );

    expect(
      (deps.services.createService as unknown as { stockItemRepository: object })
        .stockItemRepository,
    ).toBe(infra.stockItemRepository);
    expect(
      (
        deps.serviceTasks.addServiceTask as unknown as {
          serviceRepository: object;
          stockItemRepository: object;
          workOrderRepository: object;
        }
      ).serviceRepository,
    ).toBe(infra.serviceRepository);
    expect(
      (
        deps.serviceTasks.addServiceTask as unknown as {
          serviceRepository: object;
          stockItemRepository: object;
          workOrderRepository: object;
        }
      ).stockItemRepository,
    ).toBe(infra.stockItemRepository);
    expect(
      (
        deps.serviceTasks.addServiceTask as unknown as {
          serviceRepository: object;
          stockItemRepository: object;
          workOrderRepository: object;
        }
      ).workOrderRepository,
    ).toBe(infra.workOrderRepository);

    const completeServiceTask = deps.serviceTasks
      .completeServiceTask as unknown as CompleteServiceTask & {
      notificationDeps: {
        vehicleRepository: object;
        personRepository: object;
        notification: object;
      };
    };
    expect(completeServiceTask).toBeInstanceOf(CompleteServiceTask);
    expect(completeServiceTask.notificationDeps.vehicleRepository).toBe(infra.vehicleRepository);
    expect(completeServiceTask.notificationDeps.personRepository).toBe(infra.personRepository);
    expect(completeServiceTask.notificationDeps.notification).toBe(infra.notification);

    const completeDiagnosis = deps.workOrders.completeDiagnosis as unknown as CompleteDiagnosis & {
      notificationDeps: {
        vehicleRepository: object;
        personRepository: object;
        serviceTaskRepository: object;
        serviceRepository: object;
        stockItemRepository: object;
        notification: object;
        publicBaseUrl: string;
      };
    };
    expect(completeDiagnosis).toBeInstanceOf(CompleteDiagnosis);
    expect(completeDiagnosis.notificationDeps.vehicleRepository).toBe(infra.vehicleRepository);
    expect(completeDiagnosis.notificationDeps.personRepository).toBe(infra.personRepository);
    expect(completeDiagnosis.notificationDeps.serviceTaskRepository).toBe(
      infra.serviceTaskRepository,
    );
    expect(completeDiagnosis.notificationDeps.serviceRepository).toBe(infra.serviceRepository);
    expect(completeDiagnosis.notificationDeps.stockItemRepository).toBe(infra.stockItemRepository);
    expect(completeDiagnosis.notificationDeps.notification).toBe(infra.notification);
    expect(completeDiagnosis.notificationDeps.publicBaseUrl).toBe("http://localhost:8080");
  });
});
