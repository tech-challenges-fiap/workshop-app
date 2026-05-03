export enum ServiceTaskStatus {
  PENDING_APPROVAL = "PENDING_APPROVAL",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  IN_EXECUTION = "IN_EXECUTION",
  COMPLETED = "COMPLETED",
  CANCELED = "CANCELED",
}

const serviceTaskStatusValues = new Set<ServiceTaskStatus>(Object.values(ServiceTaskStatus));

function isServiceTaskStatus(value: string): value is ServiceTaskStatus {
  return serviceTaskStatusValues.has(value as ServiceTaskStatus);
}

export function assertServiceTaskStatus(raw: string): ServiceTaskStatus {
  const normalized = raw?.trim().toUpperCase();

  if (!normalized) {
    throw new Error("Service task status must not be empty");
  }

  if (!isServiceTaskStatus(normalized)) {
    throw new Error("Service task status is invalid");
  }

  return normalized;
}
