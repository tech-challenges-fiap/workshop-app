import { describe, expect, it } from "bun:test";

import type { AppRuntimeConfig } from "./config";
import { buildInfrastructureDeps } from "./build-infrastructure";
import { buildApplicationDeps } from "./build-use-cases";

const TEST_CONFIG: AppRuntimeConfig = {
  adminUsername: "integration-admin",
  adminPassword: "integration-password",
  beeceptorNotificationUrl: "https://example.com/notify",
  appPort: 3000,
  jwtSecret: "integration-secret",
  jwtIssuer: "workshop-edge",
  jwtAudience: "workshop-app",
  appEnv: "test",
  rabbitMqUrl: "",
  rabbitMqExchange: "workshop.os.events",
  rabbitMqWorkOrderEventsQueue: "workshop.os.work-order-events",
  rabbitMqSagaEventsQueue: "workshop.os.saga-events",
  rabbitMqConsumersEnabled: false,
};

describe("dependency builder integration", () => {
  it("preserves critical shared wiring for service-task and work-order contexts", () => {
    const infra = buildInfrastructureDeps(TEST_CONFIG);
    const deps = buildApplicationDeps(infra, TEST_CONFIG);

    const addServiceTask = deps.serviceTasks.addServiceTask as unknown as {
      serviceRepository: object;
      stockItemRepository: object;
      workOrderRepository: object;
    };
    const startServiceExecution = deps.serviceTasks.startServiceExecution as unknown as {
      serviceRepository: object;
      stockItemRepository: object;
      workOrderRepository: object;
    };
    const createWorkOrder = deps.workOrders.createWorkOrder as unknown as {
      deps: {
        personRepository: object;
        vehicleRepository: object;
        stockItemRepository: object;
        serviceRepository: object;
        serviceTaskRepository: object;
        workOrderRepository: object;
      };
    };
    const completeDiagnosis = deps.workOrders.completeDiagnosis as unknown as {
      notificationDeps: {
        serviceTaskRepository: object;
        serviceRepository: object;
        stockItemRepository: object;
        notification: object;
      };
    };

    expect(addServiceTask.serviceRepository).toBe(infra.serviceRepository);
    expect(addServiceTask.stockItemRepository).toBe(infra.stockItemRepository);
    expect(addServiceTask.workOrderRepository).toBe(infra.workOrderRepository);
    expect(startServiceExecution.serviceRepository).toBe(infra.serviceRepository);
    expect(startServiceExecution.stockItemRepository).toBe(infra.stockItemRepository);
    expect(startServiceExecution.workOrderRepository).toBe(infra.workOrderRepository);
    expect(createWorkOrder.deps.personRepository).toBe(infra.personRepository);
    expect(createWorkOrder.deps.vehicleRepository).toBe(infra.vehicleRepository);
    expect(createWorkOrder.deps.stockItemRepository).toBe(infra.stockItemRepository);
    expect(createWorkOrder.deps.serviceRepository).toBe(infra.serviceRepository);
    expect(createWorkOrder.deps.serviceTaskRepository).toBe(infra.serviceTaskRepository);
    expect(createWorkOrder.deps.workOrderRepository).toBe(infra.workOrderRepository);
    expect(completeDiagnosis.notificationDeps.serviceTaskRepository).toBe(
      infra.serviceTaskRepository,
    );
    expect(completeDiagnosis.notificationDeps.serviceRepository).toBe(infra.serviceRepository);
    expect(completeDiagnosis.notificationDeps.stockItemRepository).toBe(infra.stockItemRepository);
    expect(completeDiagnosis.notificationDeps.notification).toBe(infra.notification);
  });
});
