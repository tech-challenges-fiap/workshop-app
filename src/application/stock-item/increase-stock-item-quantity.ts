import { StockItem } from "../../domain/stock-item/aggregate/stock-item";
import { StockItemRepository } from "../../domain/stock-item/repository/stock-item-repository";
import { StockItemNotFound } from "../../domain/stock-item/domain-error/stock-item-not-found";
import { StockItemQuantity } from "../../domain/stock-item/value-object/stock-item-quantity";

export interface IncreaseStockItemQuantityInput {
  id: number;
  quantity: number;
}

export type IncreaseStockItemQuantityOutput = ReturnType<StockItem["toSnapshot"]>;

export class IncreaseStockItemQuantity {
  constructor(private readonly stockItemRepository: StockItemRepository) {}

  public async execute(
    input: IncreaseStockItemQuantityInput,
  ): Promise<IncreaseStockItemQuantityOutput> {
    const amount = StockItemQuantity.create(input.quantity);

    const stockItem = await this.stockItemRepository.findById(input.id);

    if (!stockItem) {
      throw new StockItemNotFound(input.id);
    }

    stockItem.increaseQuantity(amount);

    await this.stockItemRepository.save(stockItem);

    return stockItem.toSnapshot();
  }
}
