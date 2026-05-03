export class VehicleModel {
  private constructor(private readonly value: string) {}

  public static create(value: string): VehicleModel {
    const trimmed = value.trim();
    if (trimmed.length < 1) {
      throw new Error("Vehicle model cannot be empty");
    }
    return new VehicleModel(trimmed);
  }

  public toString(): string {
    return this.value;
  }
}
