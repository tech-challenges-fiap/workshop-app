import assert from "node:assert/strict";

import { Given, Then, When } from "@cucumber/cucumber";
import type { DataTable } from "@cucumber/cucumber";

import { HandleInboundWorkOrderSagaEvent } from "../../src/application/work-order/handle-inbound-work-order-saga-event";
import { OrchestrateWorkOrderSaga } from "../../src/application/work-order/orchestrate-work-order-saga";
import {
  InMemoryWorkOrderSagaRepository,
  RecordingWorkOrderEventPublisher,
} from "../../src/application/work-order/test-support";
import {
  createWorkOrderEvent,
  InboundWorkOrderSagaEventName,
} from "../../src/domain/work-order/events/work-order-events";
import { WorkOrderSagaEventType, WorkOrderSagaState } from "../../src/domain/work-order/saga/work-order-saga";

const WORK_ORDER_ID = 501;
const CORRELATION_ID = "correlation-bdd-happy-path";

let repository: InMemoryWorkOrderSagaRepository;
let publisher: RecordingWorkOrderEventPublisher;
let orchestrator: OrchestrateWorkOrderSaga;
let handler: HandleInboundWorkOrderSagaEvent;
let currentSagaState: WorkOrderSagaState;

Given("uma OS aberta com diagnóstico concluído aguardando aprovação do orçamento", async () => {
  repository = new InMemoryWorkOrderSagaRepository();
  publisher = new RecordingWorkOrderEventPublisher();
  orchestrator = new OrchestrateWorkOrderSaga(repository, publisher);
  handler = new HandleInboundWorkOrderSagaEvent(orchestrator);

  const started = await orchestrator.execute({
    workOrderId: WORK_ORDER_ID,
    eventType: WorkOrderSagaEventType.STARTED,
    eventId: "os-start-501",
    correlationId: CORRELATION_ID,
    occurredAt: new Date("2026-07-19T10:00:00.000Z"),
  });
  assert.equal(started.saga.state, WorkOrderSagaState.RECEIVED);

  await orchestrator.execute({
    workOrderId: WORK_ORDER_ID,
    eventType: WorkOrderSagaEventType.DIAGNOSIS_STARTED,
  });

  const diagnosisCompleted = await orchestrator.execute({
    workOrderId: WORK_ORDER_ID,
    eventType: WorkOrderSagaEventType.DIAGNOSIS_COMPLETED,
  });
  assert.equal(diagnosisCompleted.saga.state, WorkOrderSagaState.WAITING_APPROVAL);

  currentSagaState = diagnosisCompleted.saga.state;
});

When("o orçamento é aprovado pelo serviço de billing", async () => {
  const authorized = await handler.handleEnvelope(
    createWorkOrderEvent({
      eventId: "billing-authorized-501",
      eventName: InboundWorkOrderSagaEventName.APPROVAL_GRANTED,
      correlationId: CORRELATION_ID,
      producer: "billing-service",
      payload: { workOrderId: WORK_ORDER_ID },
    }),
  );

  currentSagaState = authorized.sagaResult.saga.state;
  assert.equal(currentSagaState, WorkOrderSagaState.APPROVED);
});

When("a execução é concluída pelo serviço de execução", async () => {
  const completed = await handler.handleEnvelope(
    createWorkOrderEvent({
      eventId: "execution-completed-501",
      eventName: InboundWorkOrderSagaEventName.EXECUTION_COMPLETED,
      correlationId: CORRELATION_ID,
      producer: "execution-service",
      payload: { workOrderId: WORK_ORDER_ID },
    }),
  );

  currentSagaState = completed.sagaResult.saga.state;
});

Then("a saga da OS chega ao estado COMPLETED", () => {
  assert.equal(currentSagaState, WorkOrderSagaState.COMPLETED);
});

Then("os eventos a seguir foram publicados na ordem certa", (dataTable: DataTable) => {
  const expectedEventNames = dataTable.raw().map((row) => row[0]);
  const publishedEventNames = publisher.events.map((event) => event.eventName as string);

  assert.deepEqual(publishedEventNames, expectedEventNames);
  assert.ok(
    publisher.events.every((event) => event.correlationId === CORRELATION_ID),
    "expected every published event to preserve the inbound correlationId",
  );
});
