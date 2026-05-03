import { describe, expect, it } from "bun:test";

import { ServiceTaskStatus, assertServiceTaskStatus } from "./service-task-status";

describe("assertServiceTaskStatus", () => {
  it("returns a normalized valid status", () => {
    expect(assertServiceTaskStatus(" pending_approval ")).toBe(ServiceTaskStatus.PENDING_APPROVAL);
    expect(assertServiceTaskStatus("completed")).toBe(ServiceTaskStatus.COMPLETED);
  });

  it("throws when status is empty", () => {
    expect(() => assertServiceTaskStatus(" ")).toThrowError(
      "Service task status must not be empty",
    );
  });

  it("throws when status is invalid", () => {
    expect(() => assertServiceTaskStatus("invalid")).toThrowError("Service task status is invalid");
  });
});
