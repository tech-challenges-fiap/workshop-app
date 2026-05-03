export class StockItemNotFound extends Error {
  public readonly name = "StockItemNotFound";

  constructor(id: number) {
    super(`Stock item '${String(id)}' was not found`);
  }
}
