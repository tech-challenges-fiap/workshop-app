import type { NotificationInput } from "../../notification/notification";
import type { WorkOrder } from "../../../domain/work-order/aggregate/work-order";
import type { PersonRepository } from "../../../domain/person/repository/person-repository";
import { PersonNotFound } from "../../../domain/person/domain-error/person-not-found";
import type { ServiceRepository } from "../../../domain/service/repository/service-repository";
import { ServiceNotFound } from "../../../domain/service/domain-error/service-not-found";
import type { ServiceTaskRepository } from "../../../domain/service-task/repository/service-task-repository";
import { ServiceTaskNotFound } from "../../../domain/service-task/domain-error/service-task-not-found";
import type { StockItemRepository } from "../../../domain/stock-item/repository/stock-item-repository";
import { StockItemNotFound } from "../../../domain/stock-item/domain-error/stock-item-not-found";
import type { VehicleRepository } from "../../../domain/vehicle/repository/vehicle-repository";
import { VehicleNotFound } from "../../../domain/vehicle/domain-error/vehicle-not-found";
import type { Notification } from "../../notification/notification";

const DEFAULT_PUBLIC_BASE_URL = "http://localhost:8080";

type CompleteDiagnosisOutput = ReturnType<WorkOrder["toSnapshot"]>;

export interface CompleteDiagnosisNotificationDeps {
  vehicleRepository: VehicleRepository;
  personRepository: PersonRepository;
  serviceTaskRepository: ServiceTaskRepository;
  serviceRepository: ServiceRepository;
  stockItemRepository: StockItemRepository;
  notification: Notification;
  publicBaseUrl?: string;
}

export async function buildCompleteDiagnosisNotificationInput(
  snapshot: CompleteDiagnosisOutput,
  deps: CompleteDiagnosisNotificationDeps,
): Promise<NotificationInput> {
  const vehicle = await deps.vehicleRepository.findById(snapshot.vehicleId);

  if (!vehicle) {
    throw new VehicleNotFound(String(snapshot.vehicleId));
  }

  const vehicleSnapshot = vehicle.toSnapshot();
  const person = await deps.personRepository.findById(vehicleSnapshot.ownerPersonId);

  if (!person) {
    throw new PersonNotFound(String(vehicleSnapshot.ownerPersonId));
  }

  const baseUrl = normalizeBaseUrl(deps.publicBaseUrl ?? DEFAULT_PUBLIC_BASE_URL);
  const payload = {
    event: "diagnosis_completed",
    workOrder: snapshot,
    approvalPageUrl: `${baseUrl}/public/work-orders/${snapshot.publicToken}/approval`,
    serviceTasks: await buildServiceTaskDetails(snapshot, deps, baseUrl),
  };
  const personSnapshot = person.toSnapshot();

  return {
    email: personSnapshot.email,
    phone: personSnapshot.phone,
    message: JSON.stringify(payload),
  };
}

async function buildServiceTaskDetails(
  snapshot: CompleteDiagnosisOutput,
  deps: CompleteDiagnosisNotificationDeps,
  baseUrl: string,
): Promise<
  {
    id: number;
    status: string;
    amount: number;
    service: {
      id: number | null;
      name: string;
      estimatedTime: number;
      price: number;
    };
    requiredItems: {
      stockItemId: number;
      sku: string;
      name: string;
      description: string | null;
      unitOfMeasure: string | null;
      quantity: number;
      price: number;
    }[];
    approvalLinks: {
      approve: string;
      reject: string;
    };
  }[]
> {
  return Promise.all(
    snapshot.serviceTasks.map(async (task) => {
      const serviceTask = await deps.serviceTaskRepository.findById(task.serviceTaskId);

      if (!serviceTask) {
        throw new ServiceTaskNotFound(task.serviceTaskId);
      }

      const serviceTaskSnapshot = serviceTask.toSnapshot();
      const service = await deps.serviceRepository.findById(serviceTaskSnapshot.serviceId);

      if (!service) {
        throw new ServiceNotFound(serviceTaskSnapshot.serviceId);
      }

      const serviceSnapshot = service.toSnapshot();
      const requiredItems = await Promise.all(
        serviceSnapshot.requiredItems.map(async (requiredItem) => {
          const stockItem = await deps.stockItemRepository.findById(requiredItem.stockItemId);

          if (!stockItem) {
            throw new StockItemNotFound(requiredItem.stockItemId);
          }

          const stockSnapshot = stockItem.toSnapshot();

          return {
            stockItemId: stockSnapshot.id ?? requiredItem.stockItemId,
            sku: stockSnapshot.sku,
            name: stockSnapshot.name,
            description: stockSnapshot.description,
            unitOfMeasure: stockSnapshot.unitOfMeasure,
            quantity: requiredItem.quantity,
            price: stockSnapshot.price,
          };
        }),
      );

      const taskId = serviceTaskSnapshot.id ?? task.serviceTaskId;

      return {
        id: taskId,
        status: task.status,
        amount: task.amount,
        service: {
          id: serviceSnapshot.id,
          name: serviceSnapshot.name,
          estimatedTime: serviceSnapshot.estimatedTime,
          price: serviceSnapshot.price,
        },
        requiredItems,
        approvalLinks: {
          approve: `${baseUrl}/public/work-orders/${snapshot.publicToken}/service-tasks/${taskId}/approve`,
          reject: `${baseUrl}/public/work-orders/${snapshot.publicToken}/service-tasks/${taskId}/reject`,
        },
      };
    }),
  );
}

function normalizeBaseUrl(value: string): string {
  if (value.endsWith("/")) {
    return value.slice(0, -1);
  }

  return value;
}
