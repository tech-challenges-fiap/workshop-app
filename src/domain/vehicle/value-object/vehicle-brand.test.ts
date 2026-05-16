import { describe, expect, it } from "bun:test";
import { VehicleBrand } from "./vehicle-brand";

describe("VehicleBrand", () => {
  it("creates a valid brand and trims whitespace", () => {
    const brand = VehicleBrand.create("  Honda  ");
    expect(brand.toString()).toBe("Honda");
  });

  it("throws when brand is empty", () => {
    expect(() => VehicleBrand.create("   ")).toThrow("Vehicle brand cannot be empty");
  });
});
