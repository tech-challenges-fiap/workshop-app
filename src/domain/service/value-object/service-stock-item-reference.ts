export interface ServiceStockItemsRequiredSnapshot {
  readonly stockItemId: number;
  readonly quantity: number;
}

export class ServiceStockItemsRequired {
  private constructor(
    private readonly stockItemId: number,
    private readonly quantity: number,
  ) {}

  public static create(params: {
    stockItemId: number;
    quantity: number;
  }): ServiceStockItemsRequired {
    const quantity = params.quantity;

    if (!Number.isFinite(quantity)) {
      throw new Error("Service stock item quantity must be a finite number");
    }

    if (!Number.isInteger(quantity)) {
      throw new Error("Service stock item quantity must be an integer");
    }

    if (quantity <= 0) {
      throw new Error("Service stock item quantity must be greater than zero");
    }

    return new ServiceStockItemsRequired(params.stockItemId, quantity);
  }

  public toSnapshot(): ServiceStockItemsRequiredSnapshot {
    return {
      stockItemId: this.stockItemId,
      quantity: this.quantity,
    };
  }
}
