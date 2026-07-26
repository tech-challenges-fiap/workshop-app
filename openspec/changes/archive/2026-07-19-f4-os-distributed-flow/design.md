# f4-os-distributed-flow Design

## Overview

`workshop-app` remains the OS Service owner for work-order orchestration. It coordinates Billing and Execution through OS-owned RabbitMQ event envelopes, using the existing publisher interface and inbound saga handler. The implementation is intentionally broker-agnostic in tests: publishing is asserted through an in-memory publisher and the RabbitMQ adapter remains a boundary implementation.

## Distributed scenarios

1. **Start / Billing request**
   - OS starts or resumes a local work-order saga.
   - OS publishes `os.work-order.billing-authorization-requested.v1` with the caller `correlationId`.
   - Billing owns its authorization data and later emits `billing.work-order.approval-granted.v1` or `billing.work-order.approval-rejected.v1`.

2. **Billing authorized / Execution request**
   - The inbound handler validates the Billing envelope and hands it to the local saga orchestrator with the inbound `eventId` for idempotency.
   - On a non-duplicate authorization event, OS transitions the saga and publishes `os.work-order.execution-requested.v1` with the same `correlationId`.
   - Execution owns execution data and later emits execution lifecycle events.

3. **Failure and compensation**
   - Billing rejection or Execution failure moves the saga to compensation through the existing state machine.
   - OS publishes `os.work-order.compensation-requested.v1` containing `workOrderId` and `compensationReason` so downstream services can compensate their own data.
   - OS does not query Billing or Execution databases.

4. **Idempotency**
   - Inbound `eventId` is recorded by the saga repository.
   - Duplicate inbound messages return the duplicate saga result and publish no new outbound intents.

## Event envelope

Outbound events use the existing `WorkOrderEventEnvelope` shape: `eventId`, `eventName`, `occurredAt`, `correlationId`, `producer`, `schemaVersion`, and `payload`. Event ids for outbound intents are OS-generated unless explicitly provided by tests. The inbound event id remains the idempotency key and is not reused as the outbound event id.

## Boundaries

The distributed-flow layer depends only on the OS saga repository and `WorkOrderEventPublisher`. It does not open Billing/Execution connections, import their schemas, or require a live RabbitMQ broker for unit/integration tests.
