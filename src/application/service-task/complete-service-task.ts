import { ServiceTask } from "../../domain/service-task/aggregate/service-task";
import type { ServiceTaskRepository } from "../../domain/service-task/repository/service-task-repository";
import { ServiceTaskNotFound } from "../../domain/service-task/domain-error/service-task-not-found";
import type { WorkOrderRepository } from "../../domain/work-order/repository/work-order-repository";
import { WorkOrderNotFound } from "../../domain/work-order/domain-error/work-order-not-found";
import type { WorkOrderSnapshot } from "../../domain/work-order/aggregate/work-order";
import { WorkOrderStatus } from "../../domain/work-order/value-object/work-order-status";
import type { VehicleRepository } from "../../domain/vehicle/repository/vehicle-repository";
import type { PersonRepository } from "../../domain/person/repository/person-repository";
import type { Notification } from "../notification/notification";

export interface CompleteServiceTaskInput {
  id: number;
  completedAt?: Date;
}

export type CompleteServiceTaskOutput = ReturnType<ServiceTask["toSnapshot"]>;

interface FinalizeWorkOrderNotificationDeps {
  vehicleRepository: VehicleRepository;
  personRepository: PersonRepository;
  notification: Notification;
}

export class CompleteServiceTask {
  constructor(
    private readonly serviceTaskRepository: ServiceTaskRepository,
    private readonly workOrderRepository?: WorkOrderRepository,
    private readonly notificationDeps?: FinalizeWorkOrderNotificationDeps,
  ) {}

  public async execute(input: CompleteServiceTaskInput): Promise<CompleteServiceTaskOutput> {
    const serviceTask = await this.serviceTaskRepository.findById(input.id);

    if (!serviceTask) {
      throw new ServiceTaskNotFound(input.id);
    }

    const completedAt = input.completedAt ?? new Date();
    serviceTask.complete(completedAt);
    const taskSnapshot = serviceTask.toSnapshot();
    let workOrderBeforeStatus: WorkOrderStatus | null = null;
    let workOrderAfterSnapshot: WorkOrderSnapshot | null = null;

    if (this.workOrderRepository) {
      if (taskSnapshot.id === null) {
        throw new Error("Service task must have an id to update the work order");
      }

      const workOrder = await this.workOrderRepository.findById(taskSnapshot.workOrderId);

      if (!workOrder) {
        throw new WorkOrderNotFound(taskSnapshot.workOrderId);
      }

      const beforeSnapshot = workOrder.toSnapshot();
      workOrderBeforeStatus = beforeSnapshot.status;

      workOrder.updateServiceTaskStatus({
        serviceTaskId: taskSnapshot.id ?? 0,
        status: taskSnapshot.status,
        now: completedAt,
      });

      await this.workOrderRepository.save(workOrder);

      workOrderAfterSnapshot = workOrder.toSnapshot();
    }

    await this.serviceTaskRepository.save(serviceTask);

    if (
      workOrderAfterSnapshot &&
      workOrderBeforeStatus !== null &&
      workOrderBeforeStatus !== workOrderAfterSnapshot.status
    ) {
      await this.trySendFinalizationNotification(workOrderAfterSnapshot);
    }

    return serviceTask.toSnapshot();
  }

  private async trySendFinalizationNotification(snapshot: WorkOrderSnapshot): Promise<void> {
    const deps = this.notificationDeps;

    if (!deps) {
      return;
    }

    if (snapshot.status !== WorkOrderStatus.FINALIZED) {
      return;
    }

    try {
      const vehicle = await deps.vehicleRepository.findById(snapshot.vehicleId);

      if (!vehicle) {
        return;
      }

      const vehicleSnapshot = vehicle.toSnapshot();

      const person = await deps.personRepository.findById(vehicleSnapshot.ownerPersonId);

      if (!person) {
        return;
      }

      const personSnapshot = person.toSnapshot();

      const payload = {
        event: "work_order_finalized",
        workOrder: snapshot,
        vehicle: vehicleSnapshot,
        owner: {
          id: personSnapshot.id,
          name: personSnapshot.name,
        },
      };

      await deps.notification.send({
        email: personSnapshot.email,
        phone: personSnapshot.phone,
        message: JSON.stringify(payload),
      });
    } catch {
      // Notification failures must not prevent task completion or work order updates.
    }
  }
}
