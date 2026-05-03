export class InvalidStockItemPrice extends Error {
  constructor(public readonly value: number) {
    super(`Invalid stock item price: '${String(value)}'`);
    this.name = "InvalidStockItemPrice";
  }
}
