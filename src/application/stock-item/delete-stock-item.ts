import type { StockItemRepository } from "../../domain/stock-item/repository/stock-item-repository";
import { StockItemNotFound } from "../../domain/stock-item/domain-error/stock-item-not-found";

export interface DeleteStockItemInput {
  id: number;
}

export class DeleteStockItem {
  constructor(private readonly stockItemRepository: StockItemRepository) {}

  public async execute(input: DeleteStockItemInput): Promise<void> {
    const existing = await this.stockItemRepository.findById(input.id);

    if (!existing) {
      throw new StockItemNotFound(input.id);
    }

    await this.stockItemRepository.delete(input.id);
  }
}
