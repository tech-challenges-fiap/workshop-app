export class VehicleYear {
  private constructor(private readonly value: number) {}

  public static create(value: number): VehicleYear {
    if (!Number.isInteger(value)) {
      throw new Error("Vehicle year must be an integer");
    }
    if (value < 1900 || value > new Date().getFullYear() + 1) {
      throw new Error("Vehicle year must be valid");
    }
    return new VehicleYear(value);
  }

  public toNumber(): number {
    return this.value;
  }
}
