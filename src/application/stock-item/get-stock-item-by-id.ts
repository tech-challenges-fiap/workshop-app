import { StockItem } from "../../domain/stock-item/aggregate/stock-item";
import type { StockItemRepository } from "../../domain/stock-item/repository/stock-item-repository";
import { StockItemNotFound } from "../../domain/stock-item/domain-error/stock-item-not-found";

export interface GetStockItemByIdInput {
  id: number;
}

export type GetStockItemByIdOutput = ReturnType<StockItem["toSnapshot"]>;

export class GetStockItemById {
  constructor(private readonly stockItemRepository: StockItemRepository) {}

  public async execute(input: GetStockItemByIdInput): Promise<GetStockItemByIdOutput> {
    const stockItem = await this.stockItemRepository.findById(input.id);

    if (!stockItem) {
      throw new StockItemNotFound(input.id);
    }

    return stockItem.toSnapshot();
  }
}
