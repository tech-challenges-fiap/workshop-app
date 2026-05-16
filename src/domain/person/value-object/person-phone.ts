export class PersonPhone {
  private constructor(private readonly value: string) {}

  public static create(raw: string): PersonPhone {
    const normalized = raw?.trim();

    if (!normalized || normalized.length === 0) {
      throw new Error("Person phone must not be empty");
    }

    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      throw new Error("Person phone must be in E.164 format (e.g. +5511999999999)");
    }

    return new PersonPhone(normalized);
  }

  public toString(): string {
    return this.value;
  }
}
