import { describe, expect, it } from "bun:test";

import { ServiceName } from "./service-name";

describe("ServiceName", () => {
  it("creates a valid name and trims it", () => {
    const name = ServiceName.create("  Oil Change  ");
    expect(name.toString()).toBe("Oil Change");
  });

  it("does not allow empty name", () => {
    expect(() => ServiceName.create("   ")).toThrowError("Service name must not be empty");
  });

  it("does not allow name longer than 255 characters", () => {
    const long = "a".repeat(256);
    expect(() => ServiceName.create(long)).toThrowError(
      "Service name must be at most 255 characters long",
    );
  });
});
