export enum PersonStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  BLOCKED = "blocked",
}

function isPersonStatus(value: string): value is PersonStatus {
  return Object.values<string>(PersonStatus).includes(value);
}

export function assertPersonStatus(raw: string | undefined): PersonStatus {
  const normalized = raw?.trim().toLowerCase();

  if (!normalized) {
    throw new Error("Person status must not be empty");
  }

  if (!isPersonStatus(normalized)) {
    throw new Error("Person status must be one of: active, inactive, blocked");
  }

  return normalized;
}
