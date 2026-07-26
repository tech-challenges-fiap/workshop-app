export interface AppRuntimeConfig {
  adminUsername: string;
  adminPassword: string;
  beeceptorNotificationUrl: string;
  appPort: number;
  jwtSecret: string | undefined;
  jwtIssuer: string;
  jwtAudience: string;
  appEnv: string;
  rabbitMqUrl: string;
  rabbitMqExchange: string;
  rabbitMqWorkOrderEventsQueue: string;
  rabbitMqSagaEventsQueue: string;
  rabbitMqConsumersEnabled: boolean;
}

const DEFAULT_RABBITMQ_EXCHANGE = "workshop.os.events";
const DEFAULT_RABBITMQ_WORK_ORDER_EVENTS_QUEUE = "workshop.os.work-order-events";
const DEFAULT_RABBITMQ_SAGA_EVENTS_QUEUE = "workshop.os.saga-events";

export function loadRuntimeConfig(): AppRuntimeConfig {
  return {
    adminUsername: process.env.ADMIN_USERNAME ?? "admin",
    adminPassword: process.env.ADMIN_PASSWORD ?? "change-me",
    beeceptorNotificationUrl:
      process.env.BEECEPTOR_NOTIFICATION_URL ?? "https://app.beeceptor.com/console/14soat-group61",
    appPort: Number(process.env.APP_PORT) || 3000,
    jwtSecret: process.env.JWT_SECRET,
    jwtIssuer: process.env.JWT_ISSUER ?? "workshop-edge",
    jwtAudience: process.env.JWT_AUDIENCE ?? "workshop-app",
    appEnv: process.env.APP_ENV ?? process.env.NODE_ENV ?? "local",
    rabbitMqUrl: process.env.RABBITMQ_URL ?? "",
    rabbitMqExchange: process.env.RABBITMQ_EXCHANGE ?? DEFAULT_RABBITMQ_EXCHANGE,
    rabbitMqWorkOrderEventsQueue:
      process.env.RABBITMQ_WORK_ORDER_EVENTS_QUEUE ?? DEFAULT_RABBITMQ_WORK_ORDER_EVENTS_QUEUE,
    rabbitMqSagaEventsQueue:
      process.env.RABBITMQ_SAGA_EVENTS_QUEUE ?? DEFAULT_RABBITMQ_SAGA_EVENTS_QUEUE,
    rabbitMqConsumersEnabled: process.env.RABBITMQ_CONSUMERS_ENABLED === "true",
  };
}
