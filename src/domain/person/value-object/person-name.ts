export class PersonName {
  private constructor(private readonly value: string) {}

  public static create(raw: string): PersonName {
    const normalized = raw?.trim();

    if (!normalized || normalized.length === 0) {
      throw new Error("Person name must not be empty");
    }

    if (normalized.length > 255) {
      throw new Error("Person name must be at most 255 characters long");
    }

    return new PersonName(normalized);
  }

  public toString(): string {
    return this.value;
  }
}
