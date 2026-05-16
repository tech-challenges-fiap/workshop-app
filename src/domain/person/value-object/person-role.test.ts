import { describe, expect, it } from "bun:test";

import { PersonRole, assertPersonRole } from "./person-role";

describe("assertPersonRole", () => {
  it("returns a normalized valid role", () => {
    expect(assertPersonRole("  CUSTOMER ")).toBe(PersonRole.CUSTOMER);
    expect(assertPersonRole("mecanic")).toBe(PersonRole.MECANIC);
    expect(assertPersonRole("Front-Desk")).toBe(PersonRole.FRONT_DESK);
  });

  it("throws when role is empty", () => {
    expect(() => assertPersonRole(" ")).toThrowError("Person role must not be empty");
  });

  it("throws when role is invalid", () => {
    expect(() => assertPersonRole("manager")).toThrowError(
      "Person role must be one of: customer, mecanic, front-desk",
    );
  });
});
