export class StockItemQuantity {
  private constructor(private readonly value: number) {}

  public static create(raw: number): StockItemQuantity {
    if (!Number.isFinite(raw)) {
      throw new Error("Stock item quantity must be a finite number");
    }

    if (!Number.isInteger(raw)) {
      throw new Error("Stock item quantity must be an integer");
    }

    if (raw < 0) {
      throw new Error("Stock item quantity must not be negative");
    }

    return new StockItemQuantity(raw);
  }

  public increase(by: StockItemQuantity): StockItemQuantity {
    return new StockItemQuantity(this.value + by.value);
  }

  public decrease(by: StockItemQuantity): StockItemQuantity {
    const result = this.value - by.value;

    if (result < 0) {
      throw new Error("Stock item quantity result must not be negative");
    }

    return new StockItemQuantity(result);
  }

  public toNumber(): number {
    return this.value;
  }
}
