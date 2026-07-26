import { connect } from "../../../workshop-billing/node_modules/amqplib";
import type { Channel, ChannelModel, ConsumeMessage } from "../../../workshop-billing/node_modules/@types/amqplib";

import { OrchestrateWorkOrderSaga } from "../../src/application/work-order/orchestrate-work-order-saga";
import { HandleInboundWorkOrderSagaEvent } from "../../src/application/work-order/handle-inbound-work-order-saga-event";
import { RabbitMqWorkOrderEventPublisher } from "../../src/infrastructure/messaging/rabbitmq-work-order-event-publisher";
import {
  createWorkOrderEvent,
  InboundWorkOrderSagaEventName,
  OsWorkOrderEventName,
  type WorkOrderEventEnvelope,
} from "../../src/domain/work-order/events/work-order-events";
import type {
  RegisterWorkOrderSagaEventInput,
  WorkOrderSagaRepository,
} from "../../src/domain/work-order/repository/work-order-saga-repository";
import {
  WorkOrderSaga,
  WorkOrderSagaEventType,
} from "../../src/domain/work-order/saga/work-order-saga";

import {
  startRabbitMqRuntime,
} from "../../../workshop-billing/src/messaging/rabbitmq";
import {
  PAYMENT_AUTHORIZE_REQUESTED,
  PAYMENT_COMPENSATION_COMPLETED,
  PAYMENT_COMPENSATION_REQUESTED,
  PAYMENT_STATUS_CHANGED,
} from "../../../workshop-billing/src/messaging/handlers";
import type { MessageEnvelope as BillingEnvelope } from "../../../workshop-billing/src/messaging/envelope";

import {
  ExecutionInboundMessageHandler,
  ExecutionStatusEventPublisher,
  type ExecutionEventTransport,
} from "../../../workshop-execution/src/messaging/execution-events";
import {
  parseExecutionInboundMessage,
  serializeEventEnvelope,
  supportedSchemaVersion,
  type ExecutionTaskStatusChangedMessage,
} from "../../../workshop-execution/src/messaging/event-envelope";
import type {
  ExecutionTaskRecord,
  ExecutionTaskStatus,
  ExecutionTaskStatusPatch,
  JsonValue,
} from "../../../workshop-execution/src/repositories/execution-task-repository";

const url = process.env.RABBITMQ_URL ?? "amqp://guest:guest@127.0.0.1:5672";
const exchange = "workshop.events";
const billingAuthorizationQueue = "workshop.billing.authorization.full-smoke";
const billingCompensationQueue = "workshop.billing.compensation.full-smoke";
const executionCommandQueue = "workshop.execution.commands.full-smoke";
const osInboundQueue = "workshop.os.inbound.full-smoke";
const bridgeQueue = "workshop.smoke.bridge.full-smoke";
const monitorQueue = "workshop.smoke.monitor.full-smoke";
const executionStatusRoutingKey = "execution.task.status.changed";
const executionCreateRoutingKey = "execution.task.create.requested";
const executionUpdateRoutingKey = "execution.task.status.update.requested";
const happyCorrelationId = `f4-rabbitmq-full-happy-${Date.now()}`;
const failureCorrelationId = `f4-rabbitmq-full-failure-${Date.now()}`;

type BillingRecord = {
  id: string;
  orderId: string;
  customerId: string;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
  correlationId: string;
  status: string;
};

type PaymentAttempt = {
  id: string;
  billingRecordId: string;
  status: string;
  provider: string;
  providerReference: string;
  idempotencyKey: string;
  correlationId: string;
  metadata?: Record<string, unknown>;
};

class InMemoryWorkOrderSagaRepository implements WorkOrderSagaRepository {
  private readonly sagasByWorkOrderId = new Map<number, WorkOrderSaga>();
  private readonly events = new Map<string, RegisterWorkOrderSagaEventInput>();

  async findByWorkOrderId(workOrderId: number): Promise<WorkOrderSaga | null> {
    return this.sagasByWorkOrderId.get(workOrderId) ?? null;
  }

  async create(saga: WorkOrderSaga): Promise<WorkOrderSaga> {
    this.sagasByWorkOrderId.set(saga.toSnapshot().workOrderId, saga);
    return saga;
  }

  async save(saga: WorkOrderSaga): Promise<WorkOrderSaga> {
    this.sagasByWorkOrderId.set(saga.toSnapshot().workOrderId, saga);
    return saga;
  }

  async hasProcessedEvent(eventId: string): Promise<boolean> {
    return this.events.has(eventId);
  }

  async recordProcessedEvent(input: RegisterWorkOrderSagaEventInput): Promise<boolean> {
    if (this.events.has(input.eventId)) return false;
    this.events.set(input.eventId, input);
    return true;
  }

  snapshots() {
    return [...this.sagasByWorkOrderId.values()].map((saga) => saga.toSnapshot());
  }
}

class InMemoryExecutionTaskRepository {
  private readonly tasks = new Map<string, ExecutionTaskRecord>();
  private readonly tasksByIdempotencyKey = new Map<string, ExecutionTaskRecord>();

  async create(record: {
    readonly taskId: string;
    readonly workflowId: string;
    readonly input: JsonValue;
    readonly status?: ExecutionTaskStatus;
    readonly correlationId?: string;
    readonly idempotencyKey?: string;
  }): Promise<ExecutionTaskRecord> {
    const now = new Date();
    const created: ExecutionTaskRecord = {
      taskId: record.taskId,
      workflowId: record.workflowId,
      input: record.input,
      status: record.status ?? "queued",
      correlationId: record.correlationId,
      idempotencyKey: record.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(created.taskId, created);
    if (created.idempotencyKey) this.tasksByIdempotencyKey.set(created.idempotencyKey, created);
    return created;
  }

  async findByTaskId(taskId: string): Promise<ExecutionTaskRecord | null> {
    return this.tasks.get(taskId) ?? null;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<ExecutionTaskRecord | null> {
    return this.tasksByIdempotencyKey.get(idempotencyKey) ?? null;
  }

  async updateStatus(
    taskId: string,
    status: ExecutionTaskStatus,
    patch: ExecutionTaskStatusPatch = {},
  ): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    const updated: ExecutionTaskRecord = {
      ...task,
      status,
      result: patch.result,
      errorMessage: patch.errorMessage,
      updatedAt: new Date(),
    };
    this.tasks.set(taskId, updated);
    if (updated.idempotencyKey) this.tasksByIdempotencyKey.set(updated.idempotencyKey, updated);
    return true;
  }

  snapshots() {
    return [...this.tasks.values()].map((task) => ({
      ...task,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    }));
  }
}

const billingRecords = new Map<string, BillingRecord>();
const paymentAttempts = new Map<string, PaymentAttempt>();
let billingRecordSeq = 0;
let paymentAttemptSeq = 0;
let executionTaskSeq = 0;

const billingRepository = {
  async create(input: Omit<BillingRecord, "id">) {
    const record = { id: `bill-${++billingRecordSeq}`, ...input };
    billingRecords.set(record.id, record);
    return record;
  },
  async findById(id: string) { return billingRecords.get(id) ?? null; },
  async findByOrderId(orderId: string) {
    return [...billingRecords.values()].find((record) => record.orderId === orderId) ?? null;
  },
  async findByIdempotencyKey(idempotencyKey: string) {
    return [...billingRecords.values()].find((record) => record.idempotencyKey === idempotencyKey) ?? null;
  },
  async updateStatus(id: string, status: string) {
    const record = billingRecords.get(id);
    if (!record) return null;
    const updated = { ...record, status };
    billingRecords.set(id, updated);
    return updated;
  },
};

const paymentAttemptRepository = {
  async create(input: Omit<PaymentAttempt, "id" | "provider" | "providerReference"> & { provider?: string; providerReference?: string }) {
    const attempt = {
      id: `attempt-${++paymentAttemptSeq}`,
      provider: input.provider ?? "smoke-provider",
      providerReference: input.providerReference ?? `ref-${paymentAttemptSeq}`,
      ...input,
    };
    paymentAttempts.set(attempt.id, attempt);
    return attempt;
  },
  async findById(id: string) { return paymentAttempts.get(id) ?? null; },
  async findByIdempotencyKey(idempotencyKey: string) {
    return [...paymentAttempts.values()].find((attempt) => attempt.idempotencyKey === idempotencyKey) ?? null;
  },
  async listByBillingRecordId(billingRecordId: string) {
    return [...paymentAttempts.values()].filter((attempt) => attempt.billingRecordId === billingRecordId);
  },
  async updateStatus(id: string, status: string) {
    const attempt = paymentAttempts.get(id);
    if (!attempt) return null;
    const updated = { ...attempt, status };
    paymentAttempts.set(id, updated);
    return updated;
  },
};

function redactRabbitUrl(value: string): string {
  return value.replace(/:[^:@/]+@/, ":[REDACTED]@");
}

function billingEnvelope(type: string, correlationId: string, payload: Record<string, unknown>, eventId: string): BillingEnvelope {
  return {
    eventId,
    correlationId,
    schemaVersion: 1,
    producer: "workshop-app-smoke-bridge",
    type,
    occurredAt: new Date().toISOString(),
    payload,
  };
}

function publishJson(channel: Channel, routingKey: string, body: unknown, correlationId: string, messageId: string, type: string) {
  channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(body)), {
    contentType: "application/json",
    deliveryMode: 2,
    correlationId,
    messageId,
    type,
  });
}

async function bind(channel: Channel, queue: string, routingKeys: string[], durable = false) {
  await channel.assertQueue(queue, { durable, autoDelete: !durable });
  for (const routingKey of routingKeys) await channel.bindQueue(queue, exchange, routingKey);
  await channel.purgeQueue(queue);
}

async function waitUntil(label: string, predicate: () => boolean | Promise<boolean>, timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timeout waiting for ${label}`);
}

function safeJson(message: ConsumeMessage): Record<string, unknown> {
  return JSON.parse(message.content.toString()) as Record<string, unknown>;
}

async function main() {
  const connection = await connect(url) as ChannelModel;
  const channel = await connection.createChannel();
  await channel.assertExchange(exchange, "topic", { durable: true });

  await bind(channel, bridgeQueue, [
    OsWorkOrderEventName.BILLING_AUTHORIZATION_REQUESTED,
    OsWorkOrderEventName.EXECUTION_REQUESTED,
    OsWorkOrderEventName.COMPENSATION_REQUESTED,
    PAYMENT_STATUS_CHANGED,
    executionStatusRoutingKey,
    PAYMENT_COMPENSATION_COMPLETED,
  ]);
  await bind(channel, monitorQueue, ["#"]);
  await bind(channel, osInboundQueue, [
    InboundWorkOrderSagaEventName.APPROVAL_GRANTED,
    InboundWorkOrderSagaEventName.EXECUTION_STARTED,
    InboundWorkOrderSagaEventName.EXECUTION_COMPLETED,
    InboundWorkOrderSagaEventName.EXECUTION_FAILED,
    InboundWorkOrderSagaEventName.COMPENSATION_COMPLETED,
  ]);

  const billingRuntime = await startRabbitMqRuntime({
    config: {
      url,
      exchange,
      authorizationQueue: billingAuthorizationQueue,
      compensationQueue: billingCompensationQueue,
      authorizationRoutingKey: PAYMENT_AUTHORIZE_REQUESTED,
      compensationRoutingKeys: [PAYMENT_COMPENSATION_REQUESTED],
      statusRoutingKey: PAYMENT_STATUS_CHANGED,
      compensationResultRoutingKey: PAYMENT_COMPENSATION_COMPLETED,
      consumersEnabled: true,
    },
    billingRepository: billingRepository as never,
    paymentAttemptRepository: paymentAttemptRepository as never,
  });
  if (!billingRuntime) throw new Error("billing runtime did not start");

  await bind(channel, executionCommandQueue, [executionCreateRoutingKey, executionUpdateRoutingKey], true);
  const executionRepository = new InMemoryExecutionTaskRepository();
  const executionTransport: ExecutionEventTransport = {
    async publish(_exchange, routingKey, body) {
      const parsed = JSON.parse(body) as ExecutionTaskStatusChangedMessage;
      publishJson(channel, routingKey, parsed, parsed.correlationId, parsed.eventId, parsed.type);
    },
  };
  const executionPublisher = new ExecutionStatusEventPublisher({
    transport: executionTransport,
    config: {
      url,
      exchange,
      executionCommandQueue,
      executionStatusRoutingKey,
      consumerEnabled: true,
    },
    producer: "workshop-execution-smoke-runtime",
    generateEventId: () => `execution-event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  });
  const executionHandler = new ExecutionInboundMessageHandler({
    repository: executionRepository,
    publisher: executionPublisher,
    generateTaskId: () => `task-${++executionTaskSeq}`,
  });

  await channel.consume(executionCommandQueue, async (message) => {
    if (!message) return;
    try {
      const inbound = parseExecutionInboundMessage(message.content);
      const result = await executionHandler.handle(inbound);
      console.log(`EXECUTION_CONSUMED=${JSON.stringify({ type: inbound.type, correlationId: inbound.correlationId, action: result.action, taskId: result.task.taskId, status: result.task.status })}`);
      channel.ack(message);
    } catch (error) {
      console.error("execution smoke runtime failed", error);
      channel.nack(message, false, false);
    }
  });

  const osRepository = new InMemoryWorkOrderSagaRepository();
  const osPublisher = new RabbitMqWorkOrderEventPublisher(
    {
      publish(targetExchange, routingKey, content, options) {
        return channel.publish(targetExchange, routingKey, Buffer.from(content), options);
      },
    },
    { exchange },
  );
  const osOrchestrator = new OrchestrateWorkOrderSaga(osRepository, osPublisher);
  const osInboundHandler = new HandleInboundWorkOrderSagaEvent(osOrchestrator);

  await channel.consume(osInboundQueue, async (message) => {
    if (!message) return;
    try {
      const result = await osInboundHandler.handle(message.content);
      console.log(`OS_CONSUMED=${JSON.stringify({ eventId: result.eventId, correlationId: result.correlationId, state: result.sagaResult.saga.state })}`);
      channel.ack(message);
    } catch (error) {
      console.error("OS smoke inbound handler failed", error);
      channel.nack(message, false, false);
    }
  });

  const seen: string[] = [];
  const latestTaskByCorrelation = new Map<string, string>();
  await channel.consume(monitorQueue, (message) => {
    if (!message) return;
    const routingKey = message.fields.routingKey;
    const body = safeJson(message);
    const correlationId = String(body.correlationId ?? "");
    seen.push(`${routingKey}:${correlationId}`);
    console.log(`BROKER_EVENT=${JSON.stringify({ routingKey, correlationId, type: body.type ?? body.eventName })}`);
    if (routingKey === executionStatusRoutingKey) {
      const payload = body.payload as Record<string, unknown>;
      latestTaskByCorrelation.set(correlationId, String(payload.taskId));
    }
    channel.ack(message);
  });

  await channel.consume(bridgeQueue, async (message) => {
    if (!message) return;
    try {
      const routingKey = message.fields.routingKey;
      const body = safeJson(message);
      const correlationId = String(body.correlationId);

      if (routingKey === OsWorkOrderEventName.BILLING_AUTHORIZATION_REQUESTED) {
        const payload = body.payload as { workOrderId: number };
        publishJson(
          channel,
          PAYMENT_AUTHORIZE_REQUESTED,
          billingEnvelope(PAYMENT_AUTHORIZE_REQUESTED, correlationId, {
            orderId: `work-order-${payload.workOrderId}`,
            customerId: `customer-${payload.workOrderId}`,
            amountCents: 12345,
            currency: "BRL",
            idempotencyKey: `auth-${payload.workOrderId}-${correlationId}`,
            metadata: { sourceEventName: routingKey },
          }, `billing-auth-request-${payload.workOrderId}-${correlationId}`),
          correlationId,
          `billing-auth-request-${payload.workOrderId}-${correlationId}`,
          PAYMENT_AUTHORIZE_REQUESTED,
        );
        console.log(`BRIDGE_OS_TO_BILLING=${JSON.stringify({ correlationId, from: routingKey, to: PAYMENT_AUTHORIZE_REQUESTED })}`);
      }

      if (routingKey === PAYMENT_STATUS_CHANGED) {
        const payload = body.payload as Record<string, unknown>;
        const workOrderId = Number(String(payload.orderId).replace("work-order-", ""));
        const osEvent = createWorkOrderEvent({
          eventId: `os-approval-granted-${workOrderId}-${correlationId}`,
          eventName: InboundWorkOrderSagaEventName.APPROVAL_GRANTED,
          correlationId,
          producer: "workshop-billing-smoke-runtime",
          payload: { workOrderId },
        });
        await osPublisher.publish(osEvent);
        console.log(`BRIDGE_BILLING_TO_OS=${JSON.stringify({ correlationId, from: routingKey, to: osEvent.eventName })}`);
      }

      if (routingKey === OsWorkOrderEventName.EXECUTION_REQUESTED) {
        const payload = body.payload as { workOrderId: number };
        const executionMessage = {
          eventId: `execution-create-${payload.workOrderId}-${correlationId}`,
          correlationId,
          schemaVersion: supportedSchemaVersion,
          producer: "workshop-app-smoke-bridge",
          type: "execution.task.create.requested" as const,
          occurredAt: new Date().toISOString(),
          payload: { workflowId: `work-order-${payload.workOrderId}`, input: { workOrderId: payload.workOrderId } },
        };
        publishJson(channel, executionCreateRoutingKey, executionMessage, correlationId, executionMessage.eventId, executionMessage.type);
        console.log(`BRIDGE_OS_TO_EXECUTION=${JSON.stringify({ correlationId, from: routingKey, to: executionCreateRoutingKey })}`);
      }

      if (routingKey === executionStatusRoutingKey) {
        const payload = body.payload as Record<string, unknown>;
        const workOrderId = Number(String(payload.workflowId).replace("work-order-", ""));
        const status = String(payload.status);
        const eventName = status === "failed"
          ? InboundWorkOrderSagaEventName.EXECUTION_FAILED
          : status === "completed"
            ? InboundWorkOrderSagaEventName.EXECUTION_COMPLETED
            : status === "running"
              ? InboundWorkOrderSagaEventName.EXECUTION_STARTED
              : null;
        if (eventName) {
          const osEvent = createWorkOrderEvent({
            eventId: `os-execution-${status}-${workOrderId}-${correlationId}`,
            eventName,
            correlationId,
            producer: "workshop-execution-smoke-runtime",
            payload: {
              workOrderId,
              ...(status === "failed" ? { compensationReason: String(payload.errorMessage ?? "execution failed") } : {}),
            },
          });
          await osPublisher.publish(osEvent);
          console.log(`BRIDGE_EXECUTION_TO_OS=${JSON.stringify({ correlationId, from: routingKey, to: osEvent.eventName, status })}`);
        }
      }

      if (routingKey === OsWorkOrderEventName.COMPENSATION_REQUESTED) {
        const payload = body.payload as { workOrderId: number; compensationReason?: string };
        publishJson(
          channel,
          PAYMENT_COMPENSATION_REQUESTED,
          billingEnvelope(PAYMENT_COMPENSATION_REQUESTED, correlationId, {
            orderId: `work-order-${payload.workOrderId}`,
            reason: payload.compensationReason ?? "OS requested compensation",
            idempotencyKey: `comp-${payload.workOrderId}-${correlationId}`,
            metadata: { sourceEventName: routingKey },
          }, `billing-comp-request-${payload.workOrderId}-${correlationId}`),
          correlationId,
          `billing-comp-request-${payload.workOrderId}-${correlationId}`,
          PAYMENT_COMPENSATION_REQUESTED,
        );
        console.log(`BRIDGE_OS_TO_BILLING_COMPENSATION=${JSON.stringify({ correlationId, from: routingKey, to: PAYMENT_COMPENSATION_REQUESTED })}`);
      }

      if (routingKey === PAYMENT_COMPENSATION_COMPLETED) {
        const payload = body.payload as Record<string, unknown>;
        const workOrderId = Number(String(payload.orderId).replace("work-order-", ""));
        const osEvent = createWorkOrderEvent({
          eventId: `os-compensation-completed-${workOrderId}-${correlationId}`,
          eventName: InboundWorkOrderSagaEventName.COMPENSATION_COMPLETED,
          correlationId,
          producer: "workshop-billing-smoke-runtime",
          payload: { workOrderId },
        });
        await osPublisher.publish(osEvent);
        console.log(`BRIDGE_BILLING_COMPENSATION_TO_OS=${JSON.stringify({ correlationId, from: routingKey, to: osEvent.eventName })}`);
      }

      channel.ack(message);
    } catch (error) {
      console.error("smoke bridge failed", error);
      channel.nack(message, false, false);
    }
  });

  for (const scenario of [
    { workOrderId: 701, correlationId: happyCorrelationId, terminalState: "COMPLETED", finalExecutionStatus: "completed" as const },
    { workOrderId: 702, correlationId: failureCorrelationId, terminalState: "COMPENSATED", finalExecutionStatus: "failed" as const },
  ]) {
    await osOrchestrator.execute({
      workOrderId: scenario.workOrderId,
      eventType: WorkOrderSagaEventType.STARTED,
      eventId: `os-start-${scenario.workOrderId}`,
      correlationId: scenario.correlationId,
      occurredAt: new Date(),
    });
    await osOrchestrator.execute({ workOrderId: scenario.workOrderId, eventType: WorkOrderSagaEventType.DIAGNOSIS_STARTED });
    await osOrchestrator.execute({ workOrderId: scenario.workOrderId, eventType: WorkOrderSagaEventType.DIAGNOSIS_COMPLETED });

    await waitUntil(`execution task for ${scenario.correlationId}`, () => latestTaskByCorrelation.has(scenario.correlationId));
    const taskId = latestTaskByCorrelation.get(scenario.correlationId)!;
    const runningMessage = {
      eventId: `execution-update-running-${scenario.workOrderId}-${scenario.correlationId}`,
      correlationId: scenario.correlationId,
      schemaVersion: supportedSchemaVersion,
      producer: "workshop-smoke-driver",
      type: "execution.task.status.update.requested" as const,
      occurredAt: new Date().toISOString(),
      payload: { taskId, status: "running" as const },
    };
    publishJson(
      channel,
      executionUpdateRoutingKey,
      JSON.parse(serializeEventEnvelope(runningMessage)),
      scenario.correlationId,
      runningMessage.eventId,
      runningMessage.type,
    );
    await waitUntil(`execution task running for ${scenario.correlationId}`, async () => {
      const task = await executionRepository.findByTaskId(taskId);
      return task?.status === "running";
    });

    const updateMessage = {
      eventId: `execution-update-${scenario.finalExecutionStatus}-${scenario.workOrderId}-${scenario.correlationId}`,
      correlationId: scenario.correlationId,
      schemaVersion: supportedSchemaVersion,
      producer: "workshop-smoke-driver",
      type: "execution.task.status.update.requested" as const,
      occurredAt: new Date().toISOString(),
      payload: {
        taskId,
        status: scenario.finalExecutionStatus,
        ...(scenario.finalExecutionStatus === "completed"
          ? { result: { smoke: "happy-path-complete" } }
          : { errorMessage: "technician could not complete service" }),
      },
    };
    publishJson(
      channel,
      executionUpdateRoutingKey,
      JSON.parse(serializeEventEnvelope(updateMessage)),
      scenario.correlationId,
      updateMessage.eventId,
      updateMessage.type,
    );
    await waitUntil(`OS terminal ${scenario.terminalState} for ${scenario.correlationId}`, () => {
      const snapshot = osRepository.snapshots().find((item) => item.workOrderId === scenario.workOrderId);
      return snapshot?.state === scenario.terminalState;
    });
    const snapshot = osRepository.snapshots().find((item) => item.workOrderId === scenario.workOrderId);
    console.log(`SCENARIO_RESULT=${JSON.stringify({ correlationId: scenario.correlationId, workOrderId: scenario.workOrderId, state: snapshot?.state })}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 500));
  console.log("SMOKE_STATUS=complete-os-billing-execution-live-rabbitmq-harness");
  console.log(`RABBITMQ_URL=${redactRabbitUrl(url)}`);
  console.log(`HAPPY_CORRELATION_ID=${happyCorrelationId}`);
  console.log(`FAILURE_CORRELATION_ID=${failureCorrelationId}`);
  console.log(`OS_SAGAS=${JSON.stringify(osRepository.snapshots())}`);
  console.log(`BILLING_RECORDS=${JSON.stringify([...billingRecords.values()])}`);
  console.log(`PAYMENT_ATTEMPTS=${JSON.stringify([...paymentAttempts.values()])}`);
  console.log(`EXECUTION_TASKS=${JSON.stringify(executionRepository.snapshots())}`);
  console.log(`BROKER_EVENT_COUNT=${seen.length}`);

  await billingRuntime.close();
  await channel.close();
  await connection.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
