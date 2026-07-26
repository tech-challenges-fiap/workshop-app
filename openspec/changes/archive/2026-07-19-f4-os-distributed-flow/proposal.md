# f4-os-distributed-flow Proposal

## Summary

Connect the OS Service Phase 4 saga foundation to the RabbitMQ event boundary by modeling the distributed work-order flow that coordinates Billing and Execution through OS-owned outbound intents and idempotent inbound saga events.

## Motivation

Previous Phase 4 changes added OS service boundaries, durable saga state, and RabbitMQ envelope/publisher primitives. The final OS-owned task needs to define and exercise how `workshop-app` drives the distributed flow without taking ownership of Billing, Execution, platform, or edge repositories.

## Scope

- Add OS-owned outbound request/intent events for Billing authorization, Execution start, and distributed compensation.
- Drive those intents from the local saga orchestrator and inbound saga event handler.
- Preserve event envelope fields including `eventId`, `correlationId`, `producer`, `schemaVersion`, and payload `workOrderId`.
- Ensure duplicate inbound events do not republish outbound intents or mutate saga state twice.
- Document the boundary and provide test evidence without requiring a live RabbitMQ broker.

## Out of scope

- Billing, Execution, platform, or edge repository changes.
- Direct Billing or Execution database access.
- Live end-to-end broker deployment claims.
- RabbitMQ connection lifecycle or consumer daemon implementation beyond the existing publisher/handler boundary.
