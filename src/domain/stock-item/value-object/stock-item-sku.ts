export class StockItemSku {
  private constructor(private readonly value: string) {}

  public static create(raw: string): StockItemSku {
    const normalized = raw?.trim();

    if (!normalized || normalized.length === 0) {
      throw new Error("Stock item SKU must not be empty");
    }

    return new StockItemSku(normalized);
  }

  public toString(): string {
    return this.value;
  }
}
