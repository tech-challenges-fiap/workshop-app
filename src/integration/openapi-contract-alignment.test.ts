import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

function extractSection(content: string, startMarker: string, endMarker: string): string {
  const startIndex = content.indexOf(startMarker);
  if (startIndex === -1) {
    throw new Error(`Missing OpenAPI section start: ${startMarker}`);
  }

  const endIndex = content.indexOf(endMarker, startIndex + startMarker.length);
  if (endIndex === -1) {
    throw new Error(`Missing OpenAPI section end: ${endMarker}`);
  }

  return content.slice(startIndex, endIndex);
}

function readOpenApiSpec(): string {
  const openApiFile = new URL("../../docs/openapi.yaml", import.meta.url);
  return readFileSync(openApiFile, "utf8");
}

describe("OpenAPI contract alignment", () => {
  it("documents POST /work-orders full payload and 400/409 semantics", () => {
    const spec = readOpenApiSpec();
    const workOrdersPathSection = extractSection(spec, "  /work-orders:\n", "  /work-orders/{id}:");
    const createPartSchemaSection = extractSection(
      spec,
      "    CreateWorkOrderPartRequest:\n",
      "    CreateWorkOrderServicePartReferenceRequest:\n",
    );
    const createServiceSchemaSection = extractSection(
      spec,
      "    CreateWorkOrderServiceRequest:\n",
      "    WorkOrderServiceTask:\n",
    );

    expect(workOrdersPathSection).toContain("summary: Create work order");
    expect(workOrdersPathSection).toContain("full payload contract");
    expect(workOrdersPathSection).toContain("payloadValidationError:");
    expect(workOrdersPathSection).toContain("duplicatePersonDocument:");
    expect(workOrdersPathSection).toContain("oneOf:");
    expect(workOrdersPathSection).toContain("#/components/schemas/ValidationErrorResponse");
    expect(workOrdersPathSection).toContain("#/components/schemas/DomainErrorResponse");

    expect(createPartSchemaSection).toContain("- sku");
    expect(createPartSchemaSection).toContain("- name");
    expect(createPartSchemaSection).toContain("- quantity");
    expect(createPartSchemaSection).toContain("- price");
    expect(createPartSchemaSection).not.toContain("- description");
    expect(createPartSchemaSection).not.toContain("- unitOfMeasure");

    expect(createServiceSchemaSection).toContain(
      "description: Optional list; defaults to an empty list when omitted.",
    );
    expect(createServiceSchemaSection).toContain("- name");
    expect(createServiceSchemaSection).toContain("- estimatedTime");
    expect(createServiceSchemaSection).toContain("- price");
    expect(createServiceSchemaSection).not.toContain("- requiredParts");
  });

  it("documents GET /work-orders operational queue filter and ordering semantics", () => {
    const spec = readOpenApiSpec();
    const workOrdersPathSection = extractSection(spec, "  /work-orders:\n", "  /work-orders/{id}:");

    expect(workOrdersPathSection).toContain(
      "Includes only `IN_EXECUTION`, `WAITING_APPROVAL`, `DIAGNOSIS`, and `RECEIVED`.",
    );
    expect(workOrdersPathSection).toContain(
      "Results are ordered by status priority, then oldest `updatedAt`, then ascending `id`.",
    );
    expect(workOrdersPathSection).toContain("operationalQueue:");
    expect(workOrdersPathSection).toContain("status: IN_EXECUTION");
    expect(workOrdersPathSection).toContain("status: WAITING_APPROVAL");
    expect(workOrdersPathSection).toContain("status: DIAGNOSIS");
    expect(workOrdersPathSection).toContain("status: RECEIVED");
  });

  it("documents webhook event examples, discriminator, and error mappings", () => {
    const spec = readOpenApiSpec();
    const webhooksPathSection = extractSection(
      spec,
      "  /webhooks/work-orders/events:\n",
      "  /vehicles:\n",
    );
    const webhookEventSchemaSection = extractSection(
      spec,
      "    ExternalWebhookWorkOrderEventRequest:\n",
      "\n    # Vehicles\n",
    );

    expect(webhooksPathSection).toContain("serviceTaskApproved:");
    expect(webhooksPathSection).toContain("serviceTaskRejected:");
    expect(webhooksPathSection).toContain("statusUpdated:");
    expect(webhooksPathSection).toContain('"400":');
    expect(webhooksPathSection).toContain('"404":');
    expect(webhooksPathSection).toContain('"409":');
    expect(webhooksPathSection).toContain('"500":');
    expect(webhooksPathSection).toContain("missingServiceTaskIdForTransition:");
    expect(webhooksPathSection).toContain("workOrderNotFound:");
    expect(webhooksPathSection).toContain("transitionNotAllowed:");

    expect(webhookEventSchemaSection).toContain("discriminator:");
    expect(webhookEventSchemaSection).toContain("propertyName: eventType");
    expect(webhookEventSchemaSection).toContain("SERVICE_TASK_APPROVED:");
    expect(webhookEventSchemaSection).toContain("SERVICE_TASK_REJECTED:");
    expect(webhookEventSchemaSection).toContain("WORK_ORDER_STATUS_UPDATED:");
  });
});
