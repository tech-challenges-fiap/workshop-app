import { connect } from "../../../workshop-billing/node_modules/amqplib";
import {
  startRabbitMqRuntime,
} from "../../../workshop-billing/src/messaging/rabbitmq";
import {
  PAYMENT_AUTHORIZE_REQUESTED,
  PAYMENT_COMPENSATION_REQUESTED,
} from "../../../workshop-billing/src/messaging/handlers";
import type { MessageEnvelope } from "../../../workshop-billing/src/messaging/envelope";

const url = process.env.RABBITMQ_URL ?? "amqp://guest:guest@127.0.0.1:5672";
const exchange = "workshop.events";
const authorizationQueue = "workshop.billing.authorization";
const compensationQueue = "workshop.billing.compensation";
const statusQueue = "workshop.smoke.billing.status";
const compensationResultQueue = "workshop.smoke.billing.compensation-result";
const statusRoutingKey = "billing.payment.status.changed";
const compensationResultRoutingKey = "billing.payment.compensation.completed";
const correlationId = `f4-rabbitmq-smoke-${Date.now()}`;

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

const records = new Map<string, BillingRecord>();
const attempts = new Map<string, PaymentAttempt>();
let recordSeq = 0;
let attemptSeq = 0;

const billingRepository = {
  async create(input: Omit<BillingRecord, "id">) {
    const record = { id: `bill-${++recordSeq}`, ...input };
    records.set(record.id, record);
    return record;
  },
  async findById(id: string) { return records.get(id) ?? null; },
  async findByOrderId(orderId: string) {
    return [...records.values()].find((record) => record.orderId === orderId) ?? null;
  },
  async findByIdempotencyKey(idempotencyKey: string) {
    return [...records.values()].find((record) => record.idempotencyKey === idempotencyKey) ?? null;
  },
  async updateStatus(id: string, status: string) {
    const record = records.get(id);
    if (!record) return null;
    const updated = { ...record, status };
    records.set(id, updated);
    return updated;
  },
};

const paymentAttemptRepository = {
  async create(input: Omit<PaymentAttempt, "id" | "provider" | "providerReference"> & { provider?: string; providerReference?: string }) {
    const attempt = {
      id: `attempt-${++attemptSeq}`,
      provider: input.provider ?? "smoke-provider",
      providerReference: input.providerReference ?? `ref-${attemptSeq}`,
      ...input,
    };
    attempts.set(attempt.id, attempt);
    return attempt;
  },
  async findById(id: string) { return attempts.get(id) ?? null; },
  async findByIdempotencyKey(idempotencyKey: string) {
    return [...attempts.values()].find((attempt) => attempt.idempotencyKey === idempotencyKey) ?? null;
  },
  async listByBillingRecordId(billingRecordId: string) {
    return [...attempts.values()].filter((attempt) => attempt.billingRecordId === billingRecordId);
  },
  async updateStatus(id: string, status: string) {
    const attempt = attempts.get(id);
    if (!attempt) return null;
    const updated = { ...attempt, status };
    attempts.set(id, updated);
    return updated;
  },
};

function envelope(type: string, payload: Record<string, unknown>, eventId: string): MessageEnvelope {
  return {
    eventId,
    correlationId,
    schemaVersion: 1,
    producer: "workshop-app-smoke",
    type,
    occurredAt: new Date().toISOString(),
    payload,
  };
}

async function waitForMessage(channel: any, queue: string, label: string): Promise<MessageEnvelope> {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const message = await channel.get(queue, { noAck: false });
    if (message) {
      channel.ack(message);
      const body = JSON.parse(message.content.toString()) as MessageEnvelope;
      console.log(`${label}: ${JSON.stringify({ type: body.type, correlationId: body.correlationId, payload: body.payload })}`);
      return body;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`timeout waiting for ${label} on ${queue}`);
}

async function main() {
  const runtime = await startRabbitMqRuntime({
    config: {
      url,
      exchange,
      authorizationQueue,
      compensationQueue,
      authorizationRoutingKey: PAYMENT_AUTHORIZE_REQUESTED,
      compensationRoutingKeys: [PAYMENT_COMPENSATION_REQUESTED],
      statusRoutingKey,
      compensationResultRoutingKey,
      consumersEnabled: true,
    },
    billingRepository: billingRepository as any,
    paymentAttemptRepository: paymentAttemptRepository as any,
  });

  if (!runtime) throw new Error("runtime did not start");

  const connection = await connect(url);
  const channel = await connection.createChannel();
  await channel.assertExchange(exchange, "topic", { durable: true });
  await channel.assertQueue(statusQueue, { durable: false, autoDelete: true });
  await channel.assertQueue(compensationResultQueue, { durable: false, autoDelete: true });
  await channel.bindQueue(statusQueue, exchange, statusRoutingKey);
  await channel.bindQueue(compensationResultQueue, exchange, compensationResultRoutingKey);
  await channel.purgeQueue(statusQueue);
  await channel.purgeQueue(compensationResultQueue);

  const auth = envelope(PAYMENT_AUTHORIZE_REQUESTED, {
    orderId: "order-smoke-1",
    customerId: "customer-smoke-1",
    amountCents: 12345,
    currency: "BRL",
    idempotencyKey: "auth-smoke-1",
  }, "event-auth-smoke-1");
  channel.publish(exchange, PAYMENT_AUTHORIZE_REQUESTED, Buffer.from(JSON.stringify(auth)), {
    contentType: "application/json",
    deliveryMode: 2,
    correlationId,
    messageId: auth.eventId,
    type: auth.type,
  });
  const status = await waitForMessage(channel, statusQueue, "authorization-result");

  const comp = envelope(PAYMENT_COMPENSATION_REQUESTED, {
    orderId: "order-smoke-1",
    reason: "execution failed smoke",
    idempotencyKey: "comp-smoke-1",
  }, "event-comp-smoke-1");
  channel.publish(exchange, PAYMENT_COMPENSATION_REQUESTED, Buffer.from(JSON.stringify(comp)), {
    contentType: "application/json",
    deliveryMode: 2,
    correlationId,
    messageId: comp.eventId,
    type: comp.type,
  });
  const compensation = await waitForMessage(channel, compensationResultQueue, "compensation-result");

  console.log(`SMOKE_STATUS=partial-billing-runtime-live-rabbitmq`);
  console.log(`RABBITMQ_URL=${url.replace(/:[^:@/]+@/, ":[REDACTED]@")}`);
  console.log(`CORRELATION_ID=${correlationId}`);
  console.log(`AUTHORIZATION_OUT=${status.type}`);
  console.log(`COMPENSATION_OUT=${compensation.type}`);
  console.log(`BILLING_RECORDS=${JSON.stringify([...records.values()])}`);
  console.log(`PAYMENT_ATTEMPTS=${JSON.stringify([...attempts.values()])}`);

  await channel.close();
  await connection.close();
  await runtime.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
