import { ServiceTask } from "../../domain/service-task/aggregate/service-task";
import type { ServiceTaskRepository } from "../../domain/service-task/repository/service-task-repository";
import { ServiceTaskNotFound } from "../../domain/service-task/domain-error/service-task-not-found";
import type { StockItemRepository } from "../../domain/stock-item/repository/stock-item-repository";
import type { StockItem } from "../../domain/stock-item/aggregate/stock-item";
import { StockItemNotFound } from "../../domain/stock-item/domain-error/stock-item-not-found";
import { StockItemQuantity } from "../../domain/stock-item/value-object/stock-item-quantity";
import type { ServiceRepository } from "../../domain/service/repository/service-repository";
import { ServiceNotFound } from "../../domain/service/domain-error/service-not-found";
import type { WorkOrderRepository } from "../../domain/work-order/repository/work-order-repository";
import { WorkOrderNotFound } from "../../domain/work-order/domain-error/work-order-not-found";

export interface StartServiceExecutionInput {
  id: number;
  startedAt?: Date;
}

export type StartServiceExecutionOutput = ReturnType<ServiceTask["toSnapshot"]>;

export class StartServiceExecution {
  constructor(
    private readonly serviceTaskRepository: ServiceTaskRepository,
    private readonly serviceRepository: ServiceRepository,
    private readonly stockItemRepository: StockItemRepository,
    private readonly workOrderRepository?: WorkOrderRepository,
  ) {}

  public async execute(input: StartServiceExecutionInput): Promise<StartServiceExecutionOutput> {
    const serviceTask = await this.serviceTaskRepository.findById(input.id);

    if (!serviceTask) {
      throw new ServiceTaskNotFound(input.id);
    }

    const startedAt = input.startedAt ?? new Date();
    const workOrderRepository = this.workOrderRepository;
    let workOrder = null;

    if (workOrderRepository) {
      const workOrderId = serviceTask.toSnapshot().workOrderId;
      workOrder = await workOrderRepository.findById(workOrderId);

      if (!workOrder) {
        throw new WorkOrderNotFound(workOrderId);
      }
    }

    serviceTask.startExecution(startedAt);

    if (workOrder) {
      workOrder.startExecutionForServiceTask({
        serviceTaskId: input.id,
        now: startedAt,
      });
    }

    const taskSnapshot = serviceTask.toSnapshot();
    const service = await this.serviceRepository.findById(taskSnapshot.serviceId);

    if (!service) {
      throw new ServiceNotFound(taskSnapshot.serviceId);
    }

    const serviceSnapshot = service.toSnapshot();
    const requiredItems = serviceSnapshot.requiredItems;
    const stockItemsToSave: StockItem[] = [];

    for (const item of requiredItems) {
      const stockItem = await this.stockItemRepository.findById(item.stockItemId);

      if (!stockItem) {
        throw new StockItemNotFound(item.stockItemId);
      }

      const quantity = StockItemQuantity.create(item.quantity);
      stockItem.consume(quantity);
      stockItemsToSave.push(stockItem);
    }

    for (const stockItem of stockItemsToSave) {
      await this.stockItemRepository.save(stockItem);
    }

    await this.serviceTaskRepository.save(serviceTask);
    if (workOrder && workOrderRepository) {
      await workOrderRepository.save(workOrder);
    }

    return serviceTask.toSnapshot();
  }
}
