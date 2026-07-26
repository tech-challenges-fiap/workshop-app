import { AddServiceTask } from "../service-task/add-service-task";
import { CreatePerson } from "../person/create-person";
import { CreateService } from "../service/create-service";
import { CreateStockItem } from "../stock-item/create-stock-item";
import { CreateVehicle } from "../vehicle/create-vehicle";
import { CreateWorkOrder, type CreateWorkOrderOutput } from "./create-work-order";
import { buildRequiredItems } from "./create-work-order-with-full-payload/build-required-items";
import {
  CreateWorkOrderPayloadValidationError,
  validateCreateWorkOrderPayload,
} from "./create-work-order-with-full-payload/validate-payload";
import type { PersonRepository } from "../../domain/person/repository/person-repository";
import type { ServiceRepository } from "../../domain/service/repository/service-repository";
import type { ServiceTaskRepository } from "../../domain/service-task/repository/service-task-repository";
import type { StockItemRepository } from "../../domain/stock-item/repository/stock-item-repository";
import type { VehicleRepository } from "../../domain/vehicle/repository/vehicle-repository";
import type { WorkOrderRepository } from "../../domain/work-order/repository/work-order-repository";
import {
  noopWorkOrderMetrics,
  type WorkOrderMetrics,
} from "../../domain/work-order/observability/work-order-metrics";

export interface CreateWorkOrderCustomerInput {
  name: string;
  document: string;
  phone: string;
  email: string;
  role: string;
  status?: string;
}

export interface CreateWorkOrderVehicleInput {
  plate: string;
  brand: string;
  model: string;
  year: number;
}

export interface CreateWorkOrderPartInput {
  sku: string;
  name: string;
  description: string | null;
  quantity: number;
  unitOfMeasure: string | null;
  price: number;
}

export interface CreateWorkOrderServicePartReferenceInput {
  sku: string;
  quantity: number;
}

export interface CreateWorkOrderServiceInput {
  name: string;
  estimatedTime: number;
  price: number;
  requiredParts: CreateWorkOrderServicePartReferenceInput[];
}

export interface CreateWorkOrderWithFullPayloadInput {
  customer: CreateWorkOrderCustomerInput;
  vehicle: CreateWorkOrderVehicleInput;
  parts: CreateWorkOrderPartInput[];
  services: CreateWorkOrderServiceInput[];
  createdAt?: Date;
}

export interface CreateWorkOrderWithFullPayloadDependencies {
  personRepository: PersonRepository;
  vehicleRepository: VehicleRepository;
  stockItemRepository: StockItemRepository;
  serviceRepository: ServiceRepository;
  serviceTaskRepository: ServiceTaskRepository;
  workOrderRepository: WorkOrderRepository;
}

export interface CreateWorkOrderWithFullPayloadUnitOfWork {
  run<T>(operation: (deps: CreateWorkOrderWithFullPayloadDependencies) => Promise<T>): Promise<T>;
}
export { CreateWorkOrderPayloadValidationError };

export class CreateWorkOrderWithFullPayload {
  private readonly unitOfWork: CreateWorkOrderWithFullPayloadUnitOfWork;

  constructor(
    private readonly deps: CreateWorkOrderWithFullPayloadDependencies,
    unitOfWork?: CreateWorkOrderWithFullPayloadUnitOfWork,
    private readonly metrics: WorkOrderMetrics = noopWorkOrderMetrics,
  ) {
    this.unitOfWork = unitOfWork ?? {
      run: async (operation) => operation(this.deps),
    };
  }

  public async execute(input: CreateWorkOrderWithFullPayloadInput): Promise<CreateWorkOrderOutput> {
    validateCreateWorkOrderPayload(input);

    return this.unitOfWork.run(async (deps) => {
      const createPerson = new CreatePerson(deps.personRepository);
      const createVehicle = new CreateVehicle(deps.vehicleRepository, deps.personRepository);
      const createStockItem = new CreateStockItem(deps.stockItemRepository);
      const createService = new CreateService(deps.serviceRepository, deps.stockItemRepository);
      const createWorkOrder = new CreateWorkOrder(
        deps.workOrderRepository,
        deps.vehicleRepository,
        deps.serviceTaskRepository,
        this.metrics,
      );
      const addServiceTask = new AddServiceTask(
        deps.serviceTaskRepository,
        deps.serviceRepository,
        deps.workOrderRepository,
        deps.stockItemRepository,
      );

      const customer = await createPerson.execute(input.customer);
      const customerId = customer.id;
      if (!customerId) {
        throw new Error("Customer id must be defined after creation");
      }

      const vehicle = await createVehicle.execute({
        ...input.vehicle,
        ownerPersonId: customerId,
      });
      const vehicleId = vehicle.id;
      if (!vehicleId) {
        throw new Error("Vehicle id must be defined after creation");
      }

      const partIdsBySku = new Map<string, number>();
      for (const part of input.parts) {
        const createdPart = await createStockItem.execute(part);
        const partId = createdPart.id;
        if (!partId) {
          throw new Error("Part id must be defined after creation");
        }
        partIdsBySku.set(part.sku.trim(), partId);
      }

      const createdWorkOrder = await createWorkOrder.execute({
        vehicleId,
        serviceTasks: [],
        createdAt: input.createdAt,
      });
      const workOrderId = createdWorkOrder.id;
      if (!workOrderId) {
        throw new Error("Work order id must be defined after creation");
      }

      const workOrderInDiagnosis = await deps.workOrderRepository.findById(workOrderId);
      if (!workOrderInDiagnosis) {
        throw new Error(`Work order ${workOrderId} not found after creation`);
      }
      workOrderInDiagnosis.startDiagnosis(input.createdAt);
      await deps.workOrderRepository.save(workOrderInDiagnosis);

      this.metrics.recordStatusChange("RECEIVED", "DIAGNOSIS");

      for (const service of input.services) {
        const requiredItems = buildRequiredItems(service, partIdsBySku);

        const createdService = await createService.execute({
          name: service.name,
          estimatedTime: service.estimatedTime,
          price: service.price,
          requiredItems,
        });
        const serviceId = createdService.id;
        if (!serviceId) {
          throw new Error("Service id must be defined after creation");
        }

        await addServiceTask.execute({
          serviceId,
          workOrderId,
        });
      }

      const workOrderReadyForApproval = await deps.workOrderRepository.findById(workOrderId);
      if (!workOrderReadyForApproval) {
        throw new Error(`Work order ${workOrderId} not found after service-task creation`);
      }

      workOrderReadyForApproval.completeDiagnosis(input.createdAt);
      await deps.workOrderRepository.save(workOrderReadyForApproval);

      this.metrics.recordStatusChange("DIAGNOSIS", workOrderReadyForApproval.toSnapshot().status);

      return workOrderReadyForApproval.toSnapshot();
    });
  }
}
