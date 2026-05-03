export class ServiceName {
  private constructor(private readonly value: string) {}

  public static create(raw: string): ServiceName {
    const normalized = raw?.trim();

    if (!normalized || normalized.length === 0) {
      throw new Error("Service name must not be empty");
    }

    if (normalized.length > 255) {
      throw new Error("Service name must be at most 255 characters long");
    }

    return new ServiceName(normalized);
  }

  public toString(): string {
    return this.value;
  }
}
