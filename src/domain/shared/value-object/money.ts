export class Money {
  private readonly amount: number;

  private constructor(amount: number) {
    this.amount = amount;
  }

  public static create(amount: number): Money {
    if (!Number.isFinite(amount)) {
      throw new Error("Money amount must be a finite number");
    }

    if (amount < 0) {
      throw new Error("Money amount cannot be negative");
    }

    const scaled = Math.round(amount * 100);
    const normalized = scaled / 100;
    if (Math.abs(normalized - amount) > 1e-9) {
      throw new Error("Money amount must have at most two decimal places");
    }

    return new Money(normalized);
  }

  public toNumber(): number {
    return this.amount;
  }

  public equals(other: Money): boolean {
    return this.amount === other.amount;
  }

  public add(other: Money): Money {
    return Money.create(this.amount + other.amount);
  }

  public multiplyBy(multiplier: number): Money {
    if (!Number.isFinite(multiplier)) {
      throw new Error("Money multiplier must be a finite number");
    }

    if (!Number.isInteger(multiplier)) {
      throw new Error("Money multiplier must be an integer");
    }

    if (multiplier < 0) {
      throw new Error("Money multiplier cannot be negative");
    }

    return Money.create(this.amount * multiplier);
  }
}
