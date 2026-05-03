export interface ServiceTaskPartSnapshot {
  readonly stockItemId: number;
  readonly quantity: number;
}

export class ServiceTaskPart {
  private constructor(
    private readonly stockItemId: number,
    private readonly quantity: number,
  ) {}

  public static create(params: { stockItemId: number; quantity: number }): ServiceTaskPart {
    const { stockItemId, quantity } = params;

    if (!Number.isFinite(stockItemId)) {
      throw new Error("Service task part stock item id must be a finite number");
    }

    if (!Number.isInteger(stockItemId)) {
      throw new Error("Service task part stock item id must be an integer");
    }

    if (stockItemId <= 0) {
      throw new Error("Service task part stock item id must be greater than zero");
    }

    if (!Number.isFinite(quantity)) {
      throw new Error("Service task part quantity must be a finite number");
    }

    if (!Number.isInteger(quantity)) {
      throw new Error("Service task part quantity must be an integer");
    }

    if (quantity <= 0) {
      throw new Error("Service task part quantity must be greater than zero");
    }

    return new ServiceTaskPart(stockItemId, quantity);
  }

  public toSnapshot(): ServiceTaskPartSnapshot {
    return {
      stockItemId: this.stockItemId,
      quantity: this.quantity,
    };
  }
}
