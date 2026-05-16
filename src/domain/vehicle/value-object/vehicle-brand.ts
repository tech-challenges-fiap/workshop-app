export class VehicleBrand {
  private constructor(private readonly value: string) {}

  public static create(value: string): VehicleBrand {
    const trimmed = value.trim();
    if (trimmed.length < 1) {
      throw new Error("Vehicle brand cannot be empty");
    }
    return new VehicleBrand(trimmed);
  }

  public toString(): string {
    return this.value;
  }
}
