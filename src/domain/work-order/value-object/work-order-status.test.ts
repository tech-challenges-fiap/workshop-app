import { describe, expect, it } from "bun:test";

import { WorkOrderStatus, assertWorkOrderStatus } from "./work-order-status";

describe("assertWorkOrderStatus", () => {
  it("returns a normalized valid status", () => {
    expect(assertWorkOrderStatus(" ready ")).toBe(WorkOrderStatus.READY);
    expect(assertWorkOrderStatus("finalized")).toBe(WorkOrderStatus.FINALIZED);
  });

  it("throws when status is empty", () => {
    expect(() => assertWorkOrderStatus(" ")).toThrowError("Work order status must not be empty");
  });

  it("throws when status is invalid", () => {
    expect(() => assertWorkOrderStatus("archived")).toThrowError("Work order status is invalid");
  });
});
