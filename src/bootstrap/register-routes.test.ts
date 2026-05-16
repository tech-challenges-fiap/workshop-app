import { afterAll, beforeAll, describe, expect, it, vi } from "bun:test";
import { Hono } from "hono";

import type { ApplicationDeps } from "./build-use-cases";
import { registerRoutes } from "./register-routes";
import { InvalidCredentialsError } from "../application/auth/login-admin";
import { signToken } from "../infrastructure/auth/jwt";

const ORIGINAL_ENV = { ...process.env };

function createUseCase<Result>(result: Result) {
  return {
    execute: vi.fn(async () => result),
  };
}

function buildApplicationDeps() {
  const listStockItems = createUseCase([]);
  const approveServiceTaskByPublicToken = createUseCase({
    id: 1,
    status: "APPROVED",
  });
  const handleExternalWorkOrderEvent = createUseCase({
    eventId: "event-1",
    eventType: "SERVICE_TASK_APPROVED",
    result: "processed",
  });

  const deps = {
    auth: {
      loginAdmin: {
        execute: vi.fn(async (input: { username: string; password: string }) => {
          if (input.username !== "admin" || input.password !== "secret") {
            throw new InvalidCredentialsError();
          }

          return { subject: "admin" };
        }),
      },
    },
    stockItems: {
      createStockItem: createUseCase({}),
      increaseStockItemQuantity: createUseCase({}),
      consumeStockItemQuantity: createUseCase({}),
      getStockItemById: createUseCase({}),
      listStockItems,
      updateStockItem: createUseCase({}),
      deleteStockItem: createUseCase({}),
    },
    services: {
      createService: createUseCase({}),
      getServiceById: createUseCase({}),
      getServiceAverageDuration: createUseCase({}),
      listServices: createUseCase([]),
      updateService: createUseCase({}),
      deleteService: createUseCase({}),
    },
    serviceTasks: {
      addServiceTask: createUseCase({}),
      approveServiceTask: createUseCase({}),
      approveServiceTaskByPublicToken,
      rejectServiceTask: createUseCase({}),
      rejectServiceTaskByPublicToken: createUseCase({}),
      startServiceExecution: createUseCase({}),
      completeServiceTask: createUseCase({}),
      getServiceTaskById: createUseCase({}),
      listServiceTasks: createUseCase([]),
    },
    vehicles: {
      createVehicle: createUseCase({}),
      getVehicleById: createUseCase({}),
      listVehicles: createUseCase([]),
      getVehicleByPlate: createUseCase({}),
      updateVehicle: createUseCase({}),
      deleteVehicle: createUseCase({}),
    },
    person: {
      createPerson: createUseCase({}),
      getPersonById: createUseCase({}),
      listPersons: createUseCase([]),
      updatePerson: createUseCase({}),
      deletePerson: createUseCase({}),
    },
    workOrders: {
      createWorkOrder: createUseCase({}),
      getWorkOrderById: createUseCase({}),
      listWorkOrders: createUseCase([]),
      cancelWorkOrder: createUseCase({}),
      deliverVehicle: createUseCase({}),
      getWorkOrderByPublicToken: createUseCase({}),
      startDiagnosis: createUseCase({}),
      completeDiagnosis: createUseCase({}),
      getStatusDurationMetrics: createUseCase([]),
    },
    webhooks: {
      handleExternalWorkOrderEvent,
    },
  } as unknown as ApplicationDeps;

  return {
    deps,
    listStockItems,
    approveServiceTaskByPublicToken,
    handleExternalWorkOrderEvent,
  };
}

function createApp() {
  const app = new Hono();
  const deps = buildApplicationDeps();

  registerRoutes(app, deps.deps);

  return { app, deps };
}

beforeAll(() => {
  process.env = {
    ...ORIGINAL_ENV,
    JWT_SECRET: "test-secret",
  };
});

afterAll(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("registerRoutes", () => {
  it("enforces admin JWT middleware for protected route prefixes", async () => {
    const { app } = createApp();
    const protectedRoutes = [
      "/stock-items",
      "/services",
      "/service-tasks",
      "/vehicles",
      "/person",
      "/work-orders",
    ];

    for (const path of protectedRoutes) {
      const response = await app.request(path, { method: "GET" });

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({
        error: "Unauthorized",
      });
    }
  });

  it("keeps delegated auth disabled and public-token routes accessible without admin JWT", async () => {
    const { app, deps } = createApp();
    const authResponse = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "admin",
        password: "secret",
      }),
    });

    expect(authResponse.status).toBe(404);

    const publicApprovalResponse = await app.request(
      "/public/work-orders/public-token/service-tasks/1/approve",
      {
        method: "POST",
      },
    );

    expect(publicApprovalResponse.status).toBe(200);
    expect(await publicApprovalResponse.json()).toMatchObject({
      status: "APPROVED",
    });
    expect(deps.approveServiceTaskByPublicToken.execute).toHaveBeenCalledWith({
      publicToken: "public-token",
      serviceTaskId: 1,
    });

    const webhookResponse = await app.request("/webhooks/work-orders/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: "event-1",
        eventType: "SERVICE_TASK_APPROVED",
        workOrderId: 1,
        serviceTaskId: 1,
      }),
    });

    expect(webhookResponse.status).toBe(200);
    expect(deps.handleExternalWorkOrderEvent.execute).toHaveBeenCalledWith({
      eventId: "event-1",
      eventType: "SERVICE_TASK_APPROVED",
      occurredAt: undefined,
      workOrderId: 1,
      serviceTaskId: 1,
    });
  });

  it("allows protected routes with a valid admin JWT", async () => {
    const { app, deps } = createApp();
    const token = signToken({
      sub: "person:16899535009",
      person_id: "2",
      cpf: "16899535009",
      role: "front-desk",
      status: "active",
      jti: "test-jti",
    });
    const response = await app.request("/stock-items", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    expect(deps.listStockItems.execute).toHaveBeenCalledTimes(1);
  });
});
