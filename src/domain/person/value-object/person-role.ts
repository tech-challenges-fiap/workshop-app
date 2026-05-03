export enum PersonRole {
  CUSTOMER = "customer",
  MECANIC = "mecanic",
  FRONT_DESK = "front-desk",
}

function isPersonRole(value: string): value is PersonRole {
  return (
    value === PersonRole.CUSTOMER || value === PersonRole.MECANIC || value === PersonRole.FRONT_DESK
  );
}

export function assertPersonRole(raw: string): PersonRole {
  const normalized = raw?.trim().toLowerCase();

  if (!normalized) {
    throw new Error("Person role must not be empty");
  }

  if (!isPersonRole(normalized)) {
    throw new Error("Person role must be one of: customer, mecanic, front-desk");
  }

  return normalized;
}
