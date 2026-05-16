export class PersonEmail {
  private constructor(private readonly value: string) {}

  public static create(raw: string): PersonEmail {
    const normalized = raw?.trim();

    if (!normalized || normalized.length === 0) {
      throw new Error("Person email must not be empty");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalized)) {
      throw new Error("Person email must be a valid email address");
    }

    if (normalized.length > 255) {
      throw new Error("Person email must be at most 255 characters long");
    }

    return new PersonEmail(normalized);
  }

  public toString(): string {
    return this.value;
  }
}
