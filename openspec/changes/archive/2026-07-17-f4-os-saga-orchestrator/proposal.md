# Change: f4-os-saga-orchestrator

## Summary

Add the OS Service saga orchestration foundation for Phase 4 work-order flows. The change introduces persisted saga state, deterministic transition rules, compensation markers, and idempotent handling for external saga events without adding RabbitMQ transport or any distributed event flow.

## Why

Phase 4 requires OS Service to coordinate work-order lifecycle decisions while remaining the system of record for work-order state. The application needs a testable orchestration core before transport adapters or cross-service message flows are added.

## Scope

- Define saga state and transition semantics owned by `workshop-app`.
- Persist saga instances and processed event identities in the OS Service database.
- Provide an application-level orchestrator that applies transition decisions and records compensation intent.
- Add tests for valid transitions, invalid transitions, compensation transitions, and idempotency.

## Out of scope

- RabbitMQ exchanges, queues, producers, consumers, retry workers, or distributed message flow.
- Billing Service or Execution Service implementation.
- Direct database access to Billing or Execution Service storage.
- Public HTTP contract changes beyond existing internal application composition if not required.
