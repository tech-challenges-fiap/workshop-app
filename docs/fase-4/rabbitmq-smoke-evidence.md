# Phase 4 RabbitMQ Smoke Evidence

Date: 2026-07-19

## Status

**Complete for final operational checklist item 2** — a real local RabbitMQ broker was used and OS, Billing, and Execution were all exercised through RabbitMQ with shared `correlationId`s for one happy path and one compensation/failure path.

Scope note: this is a dedicated local smoke harness, not a full Kubernetes or three-HTTP-service-process E2E. It uses each service's real messaging boundary/handler/publisher code against the live broker:

- OS (`workshop-app`): real `OrchestrateWorkOrderSaga`, `HandleInboundWorkOrderSagaEvent`, and `RabbitMqWorkOrderEventPublisher`.
- Billing (`workshop-billing`): real `startRabbitMqRuntime`, `BillingMessageHandler`, and `RabbitMqPublisher`.
- Execution (`workshop-execution`): real `ExecutionInboundMessageHandler`, `ExecutionStatusEventPublisher`, envelope parser/serializer, and a smoke AMQP consumer/transport around those boundaries because the repository still does not expose a production `startRabbitMqRuntime` equivalent.

The harness includes small translation bridges between OS work-order event names and the Billing/Execution service message contracts. Those bridges are explicit smoke adapters; they do not fake broker traffic or service results.

## Broker startup

Container used:

```text
workshop-f4-rabbitmq-smoke
image: rabbitmq:3.13-management
ports: 5672 -> 5672, 15672 -> 15672
```

Earlier local startup blocker:

```text
Error when reading /var/lib/rabbitmq/.erlang.cookie: eacces
BOOT FAILED
```

Root cause in this host: the RabbitMQ cookie inside the mounted data directory was created as unreadable for the runtime user. The broker was made usable by pre-creating the cookie in a clean local data directory with owner UID/GID used by the RabbitMQ container and mode `400`.

Readiness/output before the full smoke:

```text
NAMES                        STATUS         PORTS
workshop-f4-rabbitmq-smoke   Up 6 minutes   4369/tcp, 5671/tcp, 0.0.0.0:5672->5672/tcp, [::]:5672->5672/tcp, 15671/tcp, 15691-15692/tcp, 25672/tcp, 0.0.0.0:15672->15672/tcp, [::]:15672->15672/tcp
```

## Smoke scripts

Billing-only partial helper retained from the earlier run:

```text
workshop-app/docs/fase-4/rabbitmq-billing-smoke.ts
```

Full OS + Billing + Execution smoke harness added:

```text
workshop-app/docs/fase-4/rabbitmq-full-smoke.ts
```

Execution command:

```bash
RABBITMQ_URL='amqp://guest:[REDACTED]@127.0.0.1:5672' bun run docs/fase-4/rabbitmq-full-smoke.ts
```

What the full harness does:

1. Connects to the live RabbitMQ broker and asserts the shared topic exchange `workshop.events`.
2. Starts Billing's real `startRabbitMqRuntime` consuming authorization and compensation messages from RabbitMQ.
3. Starts a minimal Execution smoke runtime that consumes RabbitMQ messages, parses them with `parseExecutionInboundMessage`, handles them with `ExecutionInboundMessageHandler`, and publishes status with `ExecutionStatusEventPublisher` back to RabbitMQ.
4. Starts OS saga logic with real `OrchestrateWorkOrderSaga`, real inbound saga handler, and real RabbitMQ publisher boundary.
5. Runs happy path with correlation ID `f4-rabbitmq-full-happy-1784465966870`:
   - OS publishes billing authorization intent.
   - Billing consumes authorization and publishes payment status.
   - OS consumes approval and publishes execution intent.
   - Execution consumes create/update commands and publishes running/completed status.
   - OS consumes execution completion and reaches `COMPLETED`.
6. Runs compensation/failure path with correlation ID `f4-rabbitmq-full-failure-1784465966870`:
   - OS publishes billing authorization and execution intent.
   - Execution consumes update to `failed` and publishes failed status.
   - OS consumes execution failure and publishes compensation intent.
   - Billing consumes compensation and publishes compensation completed.
   - OS consumes compensation completed and reaches `COMPENSATED`.

## Full smoke output excerpt

```text
BRIDGE_OS_TO_BILLING={"correlationId":"f4-rabbitmq-full-happy-1784465966870","from":"os.work-order.billing-authorization-requested.v1","to":"billing.payment.authorize.requested"}
BROKER_EVENT={"routingKey":"billing.payment.authorize.requested","correlationId":"f4-rabbitmq-full-happy-1784465966870","type":"billing.payment.authorize.requested"}
BROKER_EVENT={"routingKey":"billing.payment.status.changed","correlationId":"f4-rabbitmq-full-happy-1784465966870","type":"billing.payment.status.changed"}
OS_CONSUMED={"eventId":"os-approval-granted-701-f4-rabbitmq-full-happy-1784465966870","correlationId":"f4-rabbitmq-full-happy-1784465966870","state":"APPROVED"}
BRIDGE_OS_TO_EXECUTION={"correlationId":"f4-rabbitmq-full-happy-1784465966870","from":"os.work-order.execution-requested.v1","to":"execution.task.create.requested"}
EXECUTION_CONSUMED={"type":"execution.task.create.requested","correlationId":"f4-rabbitmq-full-happy-1784465966870","action":"created","taskId":"task-1","status":"queued"}
EXECUTION_CONSUMED={"type":"execution.task.status.update.requested","correlationId":"f4-rabbitmq-full-happy-1784465966870","action":"updated","taskId":"task-1","status":"running"}
BRIDGE_EXECUTION_TO_OS={"correlationId":"f4-rabbitmq-full-happy-1784465966870","from":"execution.task.status.changed","to":"execution.work-order.execution-started.v1","status":"running"}
OS_CONSUMED={"eventId":"os-execution-running-701-f4-rabbitmq-full-happy-1784465966870","correlationId":"f4-rabbitmq-full-happy-1784465966870","state":"IN_EXECUTION"}
EXECUTION_CONSUMED={"type":"execution.task.status.update.requested","correlationId":"f4-rabbitmq-full-happy-1784465966870","action":"updated","taskId":"task-1","status":"completed"}
BRIDGE_EXECUTION_TO_OS={"correlationId":"f4-rabbitmq-full-happy-1784465966870","from":"execution.task.status.changed","to":"execution.work-order.execution-completed.v1","status":"completed"}
OS_CONSUMED={"eventId":"os-execution-completed-701-f4-rabbitmq-full-happy-1784465966870","correlationId":"f4-rabbitmq-full-happy-1784465966870","state":"COMPLETED"}
SCENARIO_RESULT={"correlationId":"f4-rabbitmq-full-happy-1784465966870","workOrderId":701,"state":"COMPLETED"}

BRIDGE_OS_TO_BILLING={"correlationId":"f4-rabbitmq-full-failure-1784465966870","from":"os.work-order.billing-authorization-requested.v1","to":"billing.payment.authorize.requested"}
EXECUTION_CONSUMED={"type":"execution.task.create.requested","correlationId":"f4-rabbitmq-full-failure-1784465966870","action":"created","taskId":"task-2","status":"queued"}
EXECUTION_CONSUMED={"type":"execution.task.status.update.requested","correlationId":"f4-rabbitmq-full-failure-1784465966870","action":"updated","taskId":"task-2","status":"running"}
OS_CONSUMED={"eventId":"os-execution-running-702-f4-rabbitmq-full-failure-1784465966870","correlationId":"f4-rabbitmq-full-failure-1784465966870","state":"IN_EXECUTION"}
EXECUTION_CONSUMED={"type":"execution.task.status.update.requested","correlationId":"f4-rabbitmq-full-failure-1784465966870","action":"updated","taskId":"task-2","status":"failed"}
BRIDGE_EXECUTION_TO_OS={"correlationId":"f4-rabbitmq-full-failure-1784465966870","from":"execution.task.status.changed","to":"execution.work-order.execution-failed.v1","status":"failed"}
OS_CONSUMED={"eventId":"os-execution-failed-702-f4-rabbitmq-full-failure-1784465966870","correlationId":"f4-rabbitmq-full-failure-1784465966870","state":"COMPENSATING"}
BRIDGE_OS_TO_BILLING_COMPENSATION={"correlationId":"f4-rabbitmq-full-failure-1784465966870","from":"os.work-order.compensation-requested.v1","to":"billing.payment.compensation.requested"}
BROKER_EVENT={"routingKey":"billing.payment.compensation.completed","correlationId":"f4-rabbitmq-full-failure-1784465966870","type":"billing.payment.compensation.completed"}
BRIDGE_BILLING_COMPENSATION_TO_OS={"correlationId":"f4-rabbitmq-full-failure-1784465966870","from":"billing.payment.compensation.completed","to":"execution.work-order.compensation-completed.v1"}
OS_CONSUMED={"eventId":"os-compensation-completed-702-f4-rabbitmq-full-failure-1784465966870","correlationId":"f4-rabbitmq-full-failure-1784465966870","state":"COMPENSATED"}
SCENARIO_RESULT={"correlationId":"f4-rabbitmq-full-failure-1784465966870","workOrderId":702,"state":"COMPENSATED"}

SMOKE_STATUS=complete-os-billing-execution-live-rabbitmq-harness
RABBITMQ_URL=amqp://guest:[REDACTED]@127.0.0.1:5672
HAPPY_CORRELATION_ID=f4-rabbitmq-full-happy-1784465966870
FAILURE_CORRELATION_ID=f4-rabbitmq-full-failure-1784465966870
OS_SAGAS=[{"sagaId":"58b30645-a5e8-4315-8398-62a7990c1143","workOrderId":701,"state":"COMPLETED","lastEventId":"os-execution-completed-701-f4-rabbitmq-full-happy-1784465966870","compensationReason":null,"createdAt":"2026-07-19T12:59:26.943Z","updatedAt":"2026-07-19T12:59:27.153Z"},{"sagaId":"1ec84b6e-b0af-4f6a-b3f2-d39a87dd14b2","workOrderId":702,"state":"COMPENSATED","lastEventId":"os-compensation-completed-702-f4-rabbitmq-full-failure-1784465966870","compensationReason":"technician could not complete service","createdAt":"2026-07-19T12:59:27.252Z","updatedAt":"2026-07-19T12:59:27.467Z"}]
BILLING_RECORDS=[{"id":"bill-1","orderId":"work-order-701","customerId":"customer-701","amountCents":12345,"currency":"BRL","idempotencyKey":"auth-701-f4-rabbitmq-full-happy-1784465966870","correlationId":"f4-rabbitmq-full-happy-1784465966870","status":"processing"},{"id":"bill-2","orderId":"work-order-702","customerId":"customer-702","amountCents":12345,"currency":"BRL","idempotencyKey":"auth-702-f4-rabbitmq-full-failure-1784465966870","correlationId":"f4-rabbitmq-full-failure-1784465966870","status":"canceled"}]
PAYMENT_ATTEMPTS=[{"id":"attempt-1","provider":"smoke-provider","providerReference":"ref-1","billingRecordId":"bill-1","status":"processing","idempotencyKey":"auth-701-f4-rabbitmq-full-happy-1784465966870","correlationId":"f4-rabbitmq-full-happy-1784465966870"},{"id":"attempt-2","provider":"smoke-provider","providerReference":"ref-2","billingRecordId":"bill-2","status":"canceled","idempotencyKey":"auth-702-f4-rabbitmq-full-failure-1784465966870","correlationId":"f4-rabbitmq-full-failure-1784465966870"}]
EXECUTION_TASKS=[{"taskId":"task-1","workflowId":"work-order-701","input":{"workOrderId":701},"status":"completed","correlationId":"f4-rabbitmq-full-happy-1784465966870","idempotencyKey":"execution-create-701-f4-rabbitmq-full-happy-1784465966870","result":{"smoke":"happy-path-complete"}},{"taskId":"task-2","workflowId":"work-order-702","input":{"workOrderId":702},"status":"failed","correlationId":"f4-rabbitmq-full-failure-1784465966870","idempotencyKey":"execution-create-702-f4-rabbitmq-full-failure-1784465966870","errorMessage":"technician could not complete service"}]
BROKER_EVENT_COUNT=30
```

## Evidence achieved

| Evidence | Result |
|---|---|
| RabbitMQ live local broker | Achieved |
| OS service RabbitMQ publisher boundary publishes to broker | Achieved |
| OS service inbound saga handler consumes broker-delivered events | Achieved |
| Billing service RabbitMQ runtime connects to broker | Achieved |
| Billing authorization message consumed from broker | Achieved |
| Billing status event published to broker | Achieved |
| Execution service handler consumes broker-delivered create/update commands | Achieved through dedicated smoke runtime around real handler/parser |
| Execution status event published to broker | Achieved through real `ExecutionStatusEventPublisher` |
| Happy path OS → Billing → OS → Execution → OS | Achieved: `f4-rabbitmq-full-happy-1784465966870`, OS terminal state `COMPLETED` |
| Failure/compensation path OS → Billing → OS → Execution failure → OS compensation → Billing compensation → OS | Achieved: `f4-rabbitmq-full-failure-1784465966870`, OS terminal state `COMPENSATED` |
| Same `correlationId` preserved across each scenario | Achieved |
| Full three production HTTP service processes | Not required for this local smoke harness; not evidenced |

## Validation commands

```bash
# live smoke
bun run docs/fase-4/rabbitmq-full-smoke.ts
# result: exit 0, SMOKE_STATUS=complete-os-billing-execution-live-rabbitmq-harness

# workshop-app targeted messaging/saga tests
bun test src/application/work-order/work-order-distributed-flow.test.ts src/infrastructure/messaging/rabbitmq-work-order-event-publisher.test.ts
# result: 7 pass, 0 fail

# workshop-execution targeted messaging tests
bun test src/messaging/execution-events.test.ts src/messaging/event-envelope.test.ts
# result: 9 pass, 0 fail

# workshop-billing targeted messaging tests
bun test src/messaging/handlers.test.ts src/messaging/envelope.test.ts
# result: 6 pass, 0 fail

# builds
(cd workshop-app && bun run build)
# result: tsc -p tsconfig.build.json, exit 0
(cd workshop-billing && bun run build)
# result: Bundled 94 modules, exit 0
(cd workshop-execution && bun run build)
# result: Bundled 190 modules, exit 0
```

## Checklist decision

Final operational checklist item 2 **can be marked complete** with this evidence, with the caveat that the proof is a dedicated local RabbitMQ smoke harness around real service messaging code, not a full Kubernetes or three-HTTP-service-process demo.

Remaining operational proof for other checklist items still includes Kubernetes live deployment, CI/branch protection evidence, and final PDF/video artifacts.
