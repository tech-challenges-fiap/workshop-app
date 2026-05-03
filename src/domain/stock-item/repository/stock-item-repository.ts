import type { StockItem } from "../aggregate/stock-item";

export interface StockItemRepository {
  create(stockItem: StockItem): Promise<StockItem>;
  findById(id: number): Promise<StockItem | null>;
  findAll(): Promise<StockItem[]>;
  save(stockItem: StockItem): Promise<void>;
  delete(id: number): Promise<void>;
}
