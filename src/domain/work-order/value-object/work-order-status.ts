export enum WorkOrderStatus {
  RECEIVED = "RECEIVED",
  DIAGNOSIS = "DIAGNOSIS",
  WAITING_APPROVAL = "WAITING_APPROVAL",
  READY = "READY",
  IN_EXECUTION = "IN_EXECUTION",
  FINALIZED = "FINALIZED",
  DELIVERED = "DELIVERED",
  CANCELED = "CANCELED",
}

const workOrderStatusValues = new Set<WorkOrderStatus>(Object.values(WorkOrderStatus));

function isWorkOrderStatus(value: string): value is WorkOrderStatus {
  return workOrderStatusValues.has(value as WorkOrderStatus);
}

export function assertWorkOrderStatus(raw: string): WorkOrderStatus {
  const normalized = raw?.trim().toUpperCase();

  if (!normalized) {
    throw new Error("Work order status must not be empty");
  }

  if (!isWorkOrderStatus(normalized)) {
    throw new Error("Work order status is invalid");
  }

  return normalized;
}
