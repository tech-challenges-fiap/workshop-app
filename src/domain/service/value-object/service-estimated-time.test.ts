import { describe, expect, it } from "bun:test";

import { ServiceEstimatedTime } from "./service-estimated-time";

describe("ServiceEstimatedTime", () => {
  it("creates a valid duration in minutes", () => {
    const duration = ServiceEstimatedTime.createFromMinutes(90);
    expect(duration.toMinutes()).toBe(90);
  });

  it("does not allow non-finite values", () => {
    expect(() => ServiceEstimatedTime.createFromMinutes(Number.NaN)).toThrowError(
      "Service estimated time must be a finite number",
    );
  });

  it("does not allow non-integer values", () => {
    expect(() => ServiceEstimatedTime.createFromMinutes(1.5)).toThrowError(
      "Service estimated time must be an integer number of minutes",
    );
  });

  it("does not allow zero or negative values", () => {
    expect(() => ServiceEstimatedTime.createFromMinutes(0)).toThrowError(
      "Service estimated time must be greater than zero minutes",
    );

    expect(() => ServiceEstimatedTime.createFromMinutes(-5)).toThrowError(
      "Service estimated time must be greater than zero minutes",
    );
  });
});
