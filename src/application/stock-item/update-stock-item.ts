import { StockItem } from "../../domain/stock-item/aggregate/stock-item";
import { StockItemName } from "../../domain/stock-item/value-object/stock-item-name";
import { StockItemQuantity } from "../../domain/stock-item/value-object/stock-item-quantity";
import { StockItemSku } from "../../domain/stock-item/value-object/stock-item-sku";
import type { StockItemRepository } from "../../domain/stock-item/repository/stock-item-repository";
import { StockItemNotFound } from "../../domain/stock-item/domain-error/stock-item-not-found";
import { Money } from "../../domain/shared/value-object/money";
import { InvalidStockItemPrice } from "../../domain/stock-item/domain-error/invalid-stock-item-price";

export interface UpdateStockItemInput {
  id: number;
  name?: string;
  description?: string | null;
  unitOfMeasure?: string | null;
  price?: number;
}

export type UpdateStockItemOutput = ReturnType<StockItem["toSnapshot"]>;

export class UpdateStockItem {
  constructor(private readonly stockItemRepository: StockItemRepository) {}

  public async execute(input: UpdateStockItemInput): Promise<UpdateStockItemOutput> {
    const existing = await this.stockItemRepository.findById(input.id);

    if (!existing) {
      throw new StockItemNotFound(input.id);
    }

    const current = existing.toSnapshot();

    const name = input.name ? StockItemName.create(input.name) : StockItemName.create(current.name);
    const description = input.description !== undefined ? input.description : current.description;
    const unitOfMeasure =
      input.unitOfMeasure !== undefined ? input.unitOfMeasure : current.unitOfMeasure;
    let price = Money.create(current.price);

    if (input.price !== undefined) {
      try {
        price = Money.create(input.price);
      } catch {
        throw new InvalidStockItemPrice(input.price);
      }
    }

    const sku = StockItemSku.create(current.sku);
    const quantity = StockItemQuantity.create(current.quantity);

    const updated = StockItem.rehydrate({
      id: current.id!,
      sku,
      name,
      description,
      unitOfMeasure,
      quantity,
      price,
    });

    await this.stockItemRepository.save(updated);

    return updated.toSnapshot();
  }
}
