import { StockItemName } from "../value-object/stock-item-name";
import { StockItemQuantity } from "../value-object/stock-item-quantity";
import { StockItemSku } from "../value-object/stock-item-sku";
import { InsufficientStock } from "../domain-error/insufficient-stock";
import { Money } from "../../shared/value-object/money";

export interface StockItemSnapshot {
  readonly id: number | null;
  readonly sku: string;
  readonly name: string;
  readonly description: string | null;
  readonly unitOfMeasure: string | null;
  readonly quantity: number;
  readonly price: number;
}

export class StockItem {
  private readonly id: number | null;
  private readonly sku: StockItemSku;
  private name: StockItemName;
  private description: string | null;
  private unitOfMeasure: string | null;
  private quantity: StockItemQuantity;
  private price: Money;

  private constructor(params: {
    id: number | null;
    sku: StockItemSku;
    name: StockItemName;
    description: string | null;
    unitOfMeasure: string | null;
    quantity: StockItemQuantity;
    price: Money;
  }) {
    this.id = params.id;
    this.sku = params.sku;
    this.name = params.name;
    this.description = params.description;
    this.unitOfMeasure = params.unitOfMeasure;
    this.quantity = params.quantity;
    this.price = params.price;
  }

  public static create(params: {
    sku: StockItemSku;
    name: StockItemName;
    description?: string | null;
    unitOfMeasure?: string | null;
    initialQuantity?: StockItemQuantity;
    price: Money;
  }): StockItem {
    const item = new StockItem({
      id: null,
      sku: params.sku,
      name: params.name,
      description: params.description ?? null,
      unitOfMeasure: params.unitOfMeasure ?? null,
      quantity: params.initialQuantity ?? StockItemQuantity.create(0),
      price: params.price,
    });

    return item;
  }

  public static rehydrate(params: {
    id: number;
    sku: StockItemSku;
    name: StockItemName;
    description: string | null;
    unitOfMeasure: string | null;
    quantity: StockItemQuantity;
    price: Money;
  }): StockItem {
    return new StockItem({
      id: params.id,
      sku: params.sku,
      name: params.name,
      description: params.description,
      unitOfMeasure: params.unitOfMeasure,
      quantity: params.quantity,
      price: params.price,
    });
  }

  public increaseQuantity(amount: StockItemQuantity): void {
    this.quantity = this.quantity.increase(amount);
  }

  public consume(amount: StockItemQuantity): void {
    if (amount.toNumber() > this.quantity.toNumber()) {
      throw new InsufficientStock();
    }

    this.quantity = this.quantity.decrease(amount);
  }

  public toSnapshot(): StockItemSnapshot {
    return {
      id: this.id ?? null,
      sku: this.sku.toString(),
      name: this.name.toString(),
      description: this.description,
      unitOfMeasure: this.unitOfMeasure,
      quantity: this.quantity.toNumber(),
      price: this.price.toNumber(),
    };
  }
}
