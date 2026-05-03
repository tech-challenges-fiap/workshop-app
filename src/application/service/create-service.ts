import { Service } from "../../domain/service/aggregate/service";
import { ServiceName } from "../../domain/service/value-object/service-name";
import { ServiceEstimatedTime } from "../../domain/service/value-object/service-estimated-time";
import { ServiceStockItemsRequired } from "../../domain/service/value-object/service-stock-item-reference";
import type { ServiceRepository } from "../../domain/service/repository/service-repository";
import type { StockItemRepository } from "../../domain/stock-item/repository/stock-item-repository";
import { StockItemNotFound } from "../../domain/stock-item/domain-error/stock-item-not-found";
import { Money } from "../../domain/shared/value-object/money";
import { InvalidServicePrice } from "../../domain/service/domain-error/invalid-service-price";

export interface CreateServiceRequiredItemInput {
  stockItemId: number;
  quantity: number;
}

export interface CreateServiceInput {
  name: string;
  estimatedTime: number;
  price: number;
  requiredItems?: CreateServiceRequiredItemInput[];
}

export type CreateServiceOutput = ReturnType<Service["toSnapshot"]>;

export class CreateService {
  constructor(
    private readonly serviceRepository: ServiceRepository,
    private readonly stockItemRepository: StockItemRepository,
  ) {}

  public async execute(input: CreateServiceInput): Promise<CreateServiceOutput> {
    let price: Money;
    try {
      price = Money.create(input.price);
    } catch {
      throw new InvalidServicePrice(input.price);
    }

    const name = ServiceName.create(input.name);
    const estimatedTime = ServiceEstimatedTime.createFromMinutes(input.estimatedTime);
    const requiredItemsInput = input.requiredItems ?? [];

    for (const item of requiredItemsInput) {
      const existingStockItem = await this.stockItemRepository.findById(item.stockItemId);

      if (!existingStockItem) {
        throw new StockItemNotFound(item.stockItemId);
      }
    }

    const requiredItems = requiredItemsInput.map((item) =>
      ServiceStockItemsRequired.create({
        stockItemId: item.stockItemId,
        quantity: item.quantity,
      }),
    );

    const service = Service.create({
      name,
      estimatedTime,
      price,
      requiredItems,
    });

    const created = await this.serviceRepository.create(service);

    return created.toSnapshot();
  }
}
