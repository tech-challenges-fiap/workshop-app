import { describe, expect, it } from "bun:test";
import { VehiclePlate } from "./vehicle-plate";

describe("VehiclePlate", () => {
  it("creates a valid old-format plate (AAA-1234)", () => {
    const plate = VehiclePlate.create("ABC-1234");
    expect(plate.toString()).toBe("ABC-1234");
  });

  it("normalizes plate to uppercase and trims spaces", () => {
    const plate = VehiclePlate.create("  abc-1234  ");
    expect(plate.toString()).toBe("ABC-1234");
  });

  it("creates a valid Mercosul-format plate (AAA1A23)", () => {
    const plate = VehiclePlate.create("abc1d23");
    expect(plate.toString()).toBe("ABC1D23");
  });

  it("throws error for empty plate", () => {
    expect(() => VehiclePlate.create("  ")).toThrow("Vehicle plate cannot be empty");
  });

  it("rejects plates with invalid pattern", () => {
    const invalidPlates = [
      "AB-1234", // letters count
      "ABCD-1234", // letters count
      "ABC1234", // missing dash for old format
      "ABC-12D4", // mixed letters and digits in numeric part
      "ABC1D2", // too short for Mercosul
      "ABC1D234", // too long for Mercosul
      "A1C1D23", // invalid letter/digit positions
      "ABC 1234", // invalid separator
    ];

    for (const value of invalidPlates) {
      expect(() => VehiclePlate.create(value)).toThrow("Invalid vehicle plate format");
    }
  });
});
