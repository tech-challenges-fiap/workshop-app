export class ServiceEstimatedTime {
  private constructor(private readonly minutes: number) {}

  public static createFromMinutes(raw: number): ServiceEstimatedTime {
    if (!Number.isFinite(raw)) {
      throw new Error("Service estimated time must be a finite number");
    }

    if (!Number.isInteger(raw)) {
      throw new Error("Service estimated time must be an integer number of minutes");
    }

    if (raw <= 0) {
      throw new Error("Service estimated time must be greater than zero minutes");
    }

    return new ServiceEstimatedTime(raw);
  }

  public toMinutes(): number {
    return this.minutes;
  }
}
