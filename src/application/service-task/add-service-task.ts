import { ServiceTask } from "../../domain/service-task/aggregate/service-task";
import type { ServiceTaskRepository } from "../../domain/service-task/repository/service-task-repository";
import type { ServiceRepository } from "../../domain/service/repository/service-repository";
import type { WorkOrderRepository } from "../../domain/work-order/repository/work-order-repository";
import { ServiceNotFound } from "../../domain/service/domain-error/service-not-found";
import { WorkOrderNotFound } from "../../domain/work-order/domain-error/work-order-not-found";
import { ServiceEstimatedTime } from "../../domain/service/value-object/service-estimated-time";
import { Money } from "../../domain/shared/value-object/money";
import type { StockItemRepository } from "../../domain/stock-item/repository/stock-item-repository";
import { StockItemNotFound } from "../../domain/stock-item/domain-error/stock-item-not-found";

export interface AddServiceTaskInput {
  serviceId: number;
  workOrderId: number;
}

export type AddServiceTaskOutput = ReturnType<ServiceTask["toSnapshot"]>;

export class AddServiceTask {
  constructor(
    private readonly serviceTaskRepository: ServiceTaskRepository,
    private readonly serviceRepository: ServiceRepository,
    private readonly workOrderRepository: WorkOrderRepository,
    private readonly stockItemRepository: StockItemRepository,
  ) {}

  public async execute(input: AddServiceTaskInput): Promise<AddServiceTaskOutput> {
    const workOrder = await this.workOrderRepository.findById(input.workOrderId);

    if (!workOrder) {
      throw new WorkOrderNotFound(input.workOrderId);
    }

    const service = await this.serviceRepository.findById(input.serviceId);

    if (!service) {
      throw new ServiceNotFound(input.serviceId);
    }

    workOrder.assertCanAddServiceTask();

    const serviceSnapshot = service.toSnapshot();
    const estimatedTime = ServiceEstimatedTime.createFromMinutes(serviceSnapshot.estimatedTime);

    const requiredItems = serviceSnapshot.requiredItems;
    const stockItemPrices: { stockItemId: number; price: Money }[] = [];

    for (const item of requiredItems) {
      const stockItem = await this.stockItemRepository.findById(item.stockItemId);

      if (!stockItem) {
        throw new StockItemNotFound(item.stockItemId);
      }

      const stockItemSnapshot = stockItem.toSnapshot();
      const price = Money.create(stockItemSnapshot.price);

      stockItemPrices.push({ stockItemId: item.stockItemId, price });
    }

    const fullPrice = service.calculateFullPrice(stockItemPrices);

    const serviceTask = ServiceTask.create({
      serviceId: input.serviceId,
      estimatedTime,
      price: fullPrice,
      workOrderId: input.workOrderId,
    });

    const created = await this.serviceTaskRepository.create(serviceTask);

    const workOrderSnapshot = workOrder.toSnapshot();

    const existingTasks = workOrderSnapshot.serviceTasks.map((task) => ({
      serviceTaskId: task.serviceTaskId,
      status: task.status,
      amount: Money.create(task.amount),
    }));

    const createdSnapshot = created.toSnapshot();

    if (createdSnapshot.id === null) {
      throw new Error("Service task must have an id after creation");
    }

    const updatedTasks = [
      ...existingTasks,
      {
        serviceTaskId: createdSnapshot.id,
        status: createdSnapshot.status,
        amount: Money.create(createdSnapshot.price),
      },
    ];

    workOrder.syncServiceTasks({ tasks: updatedTasks });

    await this.workOrderRepository.save(workOrder);

    return created.toSnapshot();
  }
}
