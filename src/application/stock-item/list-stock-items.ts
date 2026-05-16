import { StockItem } from "../../domain/stock-item/aggregate/stock-item";
import type { StockItemRepository } from "../../domain/stock-item/repository/stock-item-repository";

export type ListStockItemsOutput = Array<ReturnType<StockItem["toSnapshot"]>>;

export class ListStockItems {
  constructor(private readonly stockItemRepository: StockItemRepository) {}

  public async execute(): Promise<ListStockItemsOutput> {
    const items = await this.stockItemRepository.findAll();

    return items.map((item) => item.toSnapshot());
  }
}
