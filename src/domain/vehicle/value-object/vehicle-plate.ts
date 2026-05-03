export class VehiclePlate {
  private static readonly OLD_PATTERN = /^[A-Z]{3}-\d{4}$/;
  private static readonly MERCOSUL_PATTERN = /^[A-Z]{3}\d[A-Z]\d{2}$/;

  private constructor(private readonly value: string) {}

  public static create(value: string): VehiclePlate {
    const normalized = value.trim().toUpperCase();

    if (normalized.length < 1) {
      throw new Error("Vehicle plate cannot be empty");
    }

    if (!VehiclePlate.isValid(normalized)) {
      throw new Error("Invalid vehicle plate format");
    }

    return new VehiclePlate(normalized);
  }

  private static isValid(plate: string): boolean {
    return VehiclePlate.OLD_PATTERN.test(plate) || VehiclePlate.MERCOSUL_PATTERN.test(plate);
  }

  public toString(): string {
    return this.value;
  }
}
