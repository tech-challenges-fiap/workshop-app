import { ServiceName } from "../value-object/service-name";
import { ServiceEstimatedTime } from "../value-object/service-estimated-time";
import {
  ServiceStockItemsRequired,
  type ServiceStockItemsRequiredSnapshot,
} from "../value-object/service-stock-item-reference";
import { Money } from "../../shared/value-object/money";

export interface ServiceSnapshot {
  readonly id: number | null;
  readonly name: string;
  readonly estimatedTime: number;
  readonly price: number;
  readonly requiredItems: ServiceStockItemsRequiredSnapshot[];
}

export class Service {
  private readonly id: number | null;
  private name: ServiceName;
  private estimatedTime: ServiceEstimatedTime;
  private price: Money;
  private requiredItems: ServiceStockItemsRequired[];

  private constructor(params: {
    id: number | null;
    name: ServiceName;
    estimatedTime: ServiceEstimatedTime;
    price: Money;
    requiredItems: ServiceStockItemsRequired[];
  }) {
    this.id = params.id;
    this.name = params.name;
    this.estimatedTime = params.estimatedTime;
    this.price = params.price;
    this.requiredItems = params.requiredItems;
  }

  public static create(params: {
    name: ServiceName;
    estimatedTime: ServiceEstimatedTime;
    price: Money;
    requiredItems?: ServiceStockItemsRequired[];
  }): Service {
    return new Service({
      id: null,
      name: params.name,
      estimatedTime: params.estimatedTime,
      price: params.price,
      requiredItems: params.requiredItems ?? [],
    });
  }

  public static rehydrate(params: {
    id: number;
    name: ServiceName;
    estimatedTime: ServiceEstimatedTime;
    price: Money;
    requiredItems: ServiceStockItemsRequired[];
  }): Service {
    return new Service({
      id: params.id,
      name: params.name,
      estimatedTime: params.estimatedTime,
      price: params.price,
      requiredItems: params.requiredItems,
    });
  }

  public updateDetails(params: {
    name: ServiceName;
    estimatedTime: ServiceEstimatedTime;
    price: Money;
    requiredItems: ServiceStockItemsRequired[];
  }): void {
    this.name = params.name;
    this.estimatedTime = params.estimatedTime;
    this.price = params.price;
    this.requiredItems = [...params.requiredItems];
  }

  public getPrice(): Money {
    return this.price;
  }

  public calculateFullPrice(stockItemPrices: { stockItemId: number; price: Money }[]): Money {
    const priceByStockItemId = new Map<number, Money>();

    for (const item of stockItemPrices) {
      priceByStockItemId.set(item.stockItemId, item.price);
    }

    let total = this.price;

    for (const requiredItem of this.requiredItems) {
      const snapshot = requiredItem.toSnapshot();
      const unitPrice = priceByStockItemId.get(snapshot.stockItemId);

      if (!unitPrice) {
        throw new Error(`Missing price for stock item ${snapshot.stockItemId}`);
      }

      const itemTotal = unitPrice.multiplyBy(snapshot.quantity);
      total = total.add(itemTotal);
    }

    return total;
  }

  public toSnapshot(): ServiceSnapshot {
    return {
      id: this.id,
      name: this.name.toString(),
      estimatedTime: this.estimatedTime.toMinutes(),
      price: this.price.toNumber(),
      requiredItems: this.requiredItems.map((item) => item.toSnapshot()),
    };
  }
}
