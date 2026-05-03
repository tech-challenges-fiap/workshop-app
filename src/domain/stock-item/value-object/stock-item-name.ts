export class StockItemName {
  private constructor(private readonly value: string) {}

  public static create(raw: string): StockItemName {
    const normalized = raw?.trim();

    if (!normalized || normalized.length === 0) {
      throw new Error("Stock item name must not be empty");
    }

    if (normalized.length > 255) {
      throw new Error("Stock item name must be at most 255 characters long");
    }

    return new StockItemName(normalized);
  }

  public toString(): string {
    return this.value;
  }
}
