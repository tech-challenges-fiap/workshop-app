export class SkuAlreadyExists extends Error {
  public readonly name = "SkuAlreadyExists";

  constructor(sku: string) {
    super(`Stock item with SKU '${sku}' already exists`);
  }
}
