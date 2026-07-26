import { randomUUID } from "node:crypto";

export const OS_EVENT_PRODUCER = "workshop-app";
export const OS_EVENT_SCHEMA_VERSION = 1;

export enum OsWorkOrderEventName {
  RECEIVED = "os.work-order.received.v1",
  DIAGNOSIS_STARTED = "os.work-order.diagnosis-started.v1",
  DIAGNOSIS_COMPLETED = "os.work-order.diagnosis-completed.v1",
  CANCELLED = "os.work-order.cancelled.v1",
  DELIVERED = "os.work-order.delivered.v1",
  BILLING_AUTHORIZATION_REQUESTED = "os.work-order.billing-authorization-requested.v1",
  EXECUTION_REQUESTED = "os.work-order.execution-requested.v1",
  COMPENSATION_REQUESTED = "os.work-order.compensation-requested.v1",
}

export enum InboundWorkOrderSagaEventName {
  DIAGNOSIS_STARTED = "billing.work-order.diagnosis-started.v1",
  DIAGNOSIS_COMPLETED = "billing.work-order.diagnosis-completed.v1",
  APPROVAL_GRANTED = "billing.work-order.approval-granted.v1",
  APPROVAL_REJECTED = "billing.work-order.approval-rejected.v1",
  EXECUTION_STARTED = "execution.work-order.execution-started.v1",
  EXECUTION_COMPLETED = "execution.work-order.execution-completed.v1",
  EXECUTION_FAILED = "execution.work-order.execution-failed.v1",
  VEHICLE_DELIVERED = "execution.work-order.vehicle-delivered.v1",
  CANCELLATION_REQUESTED = "billing.work-order.cancellation-requested.v1",
  COMPENSATION_COMPLETED = "execution.work-order.compensation-completed.v1",
}

export type WorkOrderEventName = OsWorkOrderEventName | InboundWorkOrderSagaEventName;

export interface WorkOrderEventPayload {
  workOrderId: number;
  status?: string;
  compensationReason?: string;
}

export interface WorkOrderEventEnvelope<TPayload extends WorkOrderEventPayload = WorkOrderEventPayload> {
  eventId: string;
  eventName: WorkOrderEventName;
  occurredAt: string;
  correlationId: string;
  producer: string;
  schemaVersion: 1;
  payload: TPayload;
}

export interface CreateWorkOrderEventInput<TPayload extends WorkOrderEventPayload> {
  eventName: WorkOrderEventName;
  payload: TPayload;
  correlationId: string;
  eventId?: string;
  occurredAt?: Date;
  producer?: string;
}

export function createWorkOrderEvent<TPayload extends WorkOrderEventPayload>(
  input: CreateWorkOrderEventInput<TPayload>,
): WorkOrderEventEnvelope<TPayload> {
  assertWorkOrderId(input.payload.workOrderId);

  const occurredAt = input.occurredAt ?? new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    throw new WorkOrderEventValidationError("occurredAt must be a valid Date");
  }

  return {
    eventId: normalizeRequiredString(input.eventId ?? randomUUID(), "eventId"),
    eventName: input.eventName,
    occurredAt: occurredAt.toISOString(),
    correlationId: normalizeRequiredString(input.correlationId, "correlationId"),
    producer: normalizeRequiredString(input.producer ?? OS_EVENT_PRODUCER, "producer"),
    schemaVersion: OS_EVENT_SCHEMA_VERSION,
    payload: input.payload,
  };
}

export function serializeWorkOrderEvent(event: WorkOrderEventEnvelope): string {
  validateWorkOrderEventEnvelope(event);
  return JSON.stringify(event);
}

export function parseWorkOrderEvent(rawMessage: string | Uint8Array): WorkOrderEventEnvelope {
  const raw = typeof rawMessage === "string" ? rawMessage : new TextDecoder().decode(rawMessage);
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new WorkOrderEventValidationError("message must be valid JSON", { cause: error });
  }

  validateWorkOrderEventEnvelope(parsed);
  return parsed;
}

export class WorkOrderEventValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "WorkOrderEventValidationError";
  }
}

function validateWorkOrderEventEnvelope(value: unknown): asserts value is WorkOrderEventEnvelope {
  if (!isRecord(value)) {
    throw new WorkOrderEventValidationError("event envelope must be an object");
  }

  normalizeRequiredString(value.eventId, "eventId");
  normalizeRequiredString(value.eventName, "eventName");
  normalizeRequiredString(value.correlationId, "correlationId");
  normalizeRequiredString(value.producer, "producer");

  if (value.schemaVersion !== OS_EVENT_SCHEMA_VERSION) {
    throw new WorkOrderEventValidationError("schemaVersion must be 1");
  }

  const occurredAt = normalizeRequiredString(value.occurredAt, "occurredAt");
  if (Number.isNaN(Date.parse(occurredAt))) {
    throw new WorkOrderEventValidationError("occurredAt must be an ISO date string");
  }

  if (!isRecord(value.payload)) {
    throw new WorkOrderEventValidationError("payload must be an object");
  }

  assertWorkOrderId(value.payload.workOrderId);
}

function normalizeRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new WorkOrderEventValidationError(`${fieldName} must be a non-empty string`);
  }

  return value;
}

function assertWorkOrderId(value: unknown): asserts value is number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new WorkOrderEventValidationError("payload.workOrderId must be a positive integer");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
