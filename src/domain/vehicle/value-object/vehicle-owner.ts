export class VehicleOwner {
  private constructor(private readonly value: string) {}

  public static create(value: string): VehicleOwner {
    const trimmed = value.trim();
    if (trimmed.length < 1) {
      throw new Error("Vehicle owner cannot be empty");
    }
    return new VehicleOwner(trimmed);
  }

  public toString(): string {
    return this.value;
  }
}
