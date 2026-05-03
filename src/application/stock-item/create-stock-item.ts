import { StockItem } from "../../domain/stock-item/aggregate/stock-item";
import { StockItemName } from "../../domain/stock-item/value-object/stock-item-name";
import { StockItemQuantity } from "../../domain/stock-item/value-object/stock-item-quantity";
import { StockItemSku } from "../../domain/stock-item/value-object/stock-item-sku";
import { StockItemRepository } from "../../domain/stock-item/repository/stock-item-repository";
import { Money } from "../../domain/shared/value-object/money";
import { InvalidStockItemPrice } from "../../domain/stock-item/domain-error/invalid-stock-item-price";

export interface CreateStockItemInput {
  sku: string;
  name: string;
  description: string | null;
  quantity: number;
  unitOfMeasure: string | null;
  price: number;
}

export type CreateStockItemOutput = ReturnType<StockItem["toSnapshot"]>;

export class CreateStockItem {
  constructor(private readonly stockItemRepository: StockItemRepository) {}

  public async execute(input: CreateStockItemInput): Promise<CreateStockItemOutput> {
    const sku = StockItemSku.create(input.sku);
    const name = StockItemName.create(input.name);
    const quantity = StockItemQuantity.create(input.quantity);
    let price: Money;

    try {
      price = Money.create(input.price);
    } catch {
      throw new InvalidStockItemPrice(input.price);
    }

    const stockItem = StockItem.create({
      sku,
      name,
      description: input.description,
      unitOfMeasure: input.unitOfMeasure,
      initialQuantity: quantity,
      price,
    });

    const createdStockItem = await this.stockItemRepository.create(stockItem);

    return createdStockItem.toSnapshot();
  }
}

export type CreateStockItemHandler = (
  input: CreateStockItemInput,
) => Promise<CreateStockItemOutput>;
