import { afterEach, describe, expect, it } from "bun:test";

import { loadRuntimeConfig } from "./config";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("loadRuntimeConfig", () => {
  it("uses default values when env vars are not defined", () => {
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.BEECEPTOR_NOTIFICATION_URL;
    delete process.env.APP_PORT;
    delete process.env.JWT_SECRET;
    delete process.env.JWT_ISSUER;
    delete process.env.JWT_AUDIENCE;
    delete process.env.APP_ENV;
    delete process.env.RABBITMQ_URL;
    delete process.env.RABBITMQ_EXCHANGE;
    delete process.env.RABBITMQ_WORK_ORDER_EVENTS_QUEUE;
    delete process.env.RABBITMQ_SAGA_EVENTS_QUEUE;
    delete process.env.RABBITMQ_CONSUMERS_ENABLED;

    const config = loadRuntimeConfig();

    expect(config).toEqual({
      adminUsername: "admin",
      adminPassword: "change-me",
      beeceptorNotificationUrl: "https://app.beeceptor.com/console/14soat-group61",
      appPort: 3000,
      jwtSecret: undefined,
      jwtIssuer: "workshop-edge",
      jwtAudience: "workshop-app",
      appEnv: "test",
      rabbitMqUrl: "",
      rabbitMqExchange: "workshop.os.events",
      rabbitMqWorkOrderEventsQueue: "workshop.os.work-order-events",
      rabbitMqSagaEventsQueue: "workshop.os.saga-events",
      rabbitMqConsumersEnabled: false,
    });
  });

  it("uses env var overrides when provided", () => {
    process.env.ADMIN_USERNAME = "custom-admin";
    process.env.ADMIN_PASSWORD = "custom-password";
    process.env.BEECEPTOR_NOTIFICATION_URL = "https://example.com/notify";
    process.env.APP_PORT = "4001";
    process.env.JWT_SECRET = "custom-secret";
    process.env.JWT_ISSUER = "custom-edge";
    process.env.JWT_AUDIENCE = "custom-app";
    process.env.APP_ENV = "stag";
    process.env.RABBITMQ_URL = "amqp://rabbitmq:5672";
    process.env.RABBITMQ_EXCHANGE = "custom.os.events";
    process.env.RABBITMQ_WORK_ORDER_EVENTS_QUEUE = "custom.work-orders";
    process.env.RABBITMQ_SAGA_EVENTS_QUEUE = "custom.sagas";
    process.env.RABBITMQ_CONSUMERS_ENABLED = "true";

    const config = loadRuntimeConfig();

    expect(config).toEqual({
      adminUsername: "custom-admin",
      adminPassword: "custom-password",
      beeceptorNotificationUrl: "https://example.com/notify",
      appPort: 4001,
      jwtSecret: "custom-secret",
      jwtIssuer: "custom-edge",
      jwtAudience: "custom-app",
      appEnv: "stag",
      rabbitMqUrl: "amqp://rabbitmq:5672",
      rabbitMqExchange: "custom.os.events",
      rabbitMqWorkOrderEventsQueue: "custom.work-orders",
      rabbitMqSagaEventsQueue: "custom.sagas",
      rabbitMqConsumersEnabled: true,
    });
  });

  it("falls back to port 3000 when APP_PORT is invalid", () => {
    process.env.APP_PORT = "invalid";

    const config = loadRuntimeConfig();

    expect(config.appPort).toBe(3000);
  });

  it("falls back to port 3000 when APP_PORT is zero", () => {
    process.env.APP_PORT = "0";

    const config = loadRuntimeConfig();

    expect(config.appPort).toBe(3000);
  });
});
