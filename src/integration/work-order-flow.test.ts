import { beforeAll, beforeEach, describe, expect, it } from "bun:test";

import { ensureDatabaseConnection, pool } from "../infrastructure/db";
import { runMigrations } from "../infrastructure/db/migrate";
import { PersonRepositoryPostgres } from "../infrastructure/person/person-repository-postgres";
import { VehicleRepositoryPostgres } from "../infrastructure/vehicle/vehicle-repository-postgres";
import { StockItemRepositoryPostgres } from "../infrastructure/stock-item/stock-item-repository-postgres";
import { ServiceRepositoryPostgres } from "../infrastructure/service/service-repository-postgres";
import { ServiceTaskRepositoryPostgres } from "../infrastructure/service-task/service-task-repository-postgres";
import { WorkOrderRepositoryPostgres } from "../infrastructure/work-order/work-order-repository-postgres";
import { CreatePerson } from "../application/person/create-person";
import { CreateVehicle } from "../application/vehicle/create-vehicle";
import { CreateStockItem } from "../application/stock-item/create-stock-item";
import { CreateService } from "../application/service/create-service";
import { ApproveServiceTask } from "../application/service-task/approve-service-task";
import { StartServiceExecution } from "../application/service-task/start-service-execution";
import { CompleteServiceTask } from "../application/service-task/complete-service-task";
import { CreateWorkOrder } from "../application/work-order/create-work-order";
import { CreateWorkOrderWithFullPayload } from "../application/work-order/create-work-order-with-full-payload";
import { AddServiceTask } from "../application/service-task/add-service-task";
import { DeliverVehicle } from "../application/work-order/deliver-vehicle";
import { CreateWorkOrderWithFullPayloadUnitOfWorkPostgres } from "../infrastructure/work-order/create-work-order-with-full-payload-unit-of-work-postgres";
import { WorkOrderStatus } from "../domain/work-order/value-object/work-order-status";
import { PersonDocumentAlreadyExists } from "../domain/person/domain-error/person-document-already-exists";
import { PlateAlreadyExists } from "../domain/vehicle/domain-error/plate-already-exists";
import { SkuAlreadyExists } from "../domain/stock-item/domain-error/sku-already-exists";

async function resetDatabase(): Promise<void> {
  await pool.query(
    "TRUNCATE TABLE work_orders, service_tasks, service_stock_items, services, vehicles, person, stock_items RESTART IDENTITY CASCADE",
  );
}

function createFullPayloadUseCase(): {
  useCase: CreateWorkOrderWithFullPayload;
  personRepository: PersonRepositoryPostgres;
  vehicleRepository: VehicleRepositoryPostgres;
  stockItemRepository: StockItemRepositoryPostgres;
} {
  const personRepository = new PersonRepositoryPostgres();
  const vehicleRepository = new VehicleRepositoryPostgres();
  const stockItemRepository = new StockItemRepositoryPostgres();
  const serviceRepository = new ServiceRepositoryPostgres();
  const serviceTaskRepository = new ServiceTaskRepositoryPostgres();
  const workOrderRepository = new WorkOrderRepositoryPostgres();

  const useCase = new CreateWorkOrderWithFullPayload(
    {
      personRepository,
      vehicleRepository,
      stockItemRepository,
      serviceRepository,
      serviceTaskRepository,
      workOrderRepository,
    },
    new CreateWorkOrderWithFullPayloadUnitOfWorkPostgres(),
  );

  return {
    useCase,
    personRepository,
    vehicleRepository,
    stockItemRepository,
  };
}

function buildFullPayloadInput(params?: {
  document?: string;
  plate?: string;
  sku?: string;
}): Parameters<CreateWorkOrderWithFullPayload["execute"]>[0] {
  const sku = params?.sku ?? "SKU-FULL-DB-BASE";

  return {
    customer: {
      name: "Maria Souza",
      document: params?.document ?? "16899535009",
      phone: "+5511988887777",
      email: "maria.souza@example.com",
      role: "customer",
    },
    vehicle: {
      plate: params?.plate ?? "FUL-9123",
      brand: "Toyota",
      model: "Corolla",
      year: 2021,
    },
    parts: [
      {
        sku,
        name: "Air Filter",
        description: null,
        quantity: 8,
        unitOfMeasure: null,
        price: 40,
      },
    ],
    services: [
      {
        name: "Revision",
        estimatedTime: 120,
        price: 300,
        requiredParts: [{ sku, quantity: 1 }],
      },
    ],
  };
}

describe("WorkOrder flow integration", () => {
  beforeAll(async () => {
    await ensureDatabaseConnection();
    await runMigrations();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates full payload and persists customer, vehicle, services, parts and relations", async () => {
    const personRepository = new PersonRepositoryPostgres();
    const vehicleRepository = new VehicleRepositoryPostgres();
    const stockItemRepository = new StockItemRepositoryPostgres();
    const serviceRepository = new ServiceRepositoryPostgres();
    const serviceTaskRepository = new ServiceTaskRepositoryPostgres();
    const workOrderRepository = new WorkOrderRepositoryPostgres();

    const createWorkOrderWithFullPayload = new CreateWorkOrderWithFullPayload(
      {
        personRepository,
        vehicleRepository,
        stockItemRepository,
        serviceRepository,
        serviceTaskRepository,
        workOrderRepository,
      },
      new CreateWorkOrderWithFullPayloadUnitOfWorkPostgres(),
    );

    const output = await createWorkOrderWithFullPayload.execute({
      customer: {
        name: "Maria Souza",
        document: "16899535009",
        phone: "+5511988887777",
        email: "maria.souza@example.com",
        role: "customer",
      },
      vehicle: {
        plate: "FUL-9123",
        brand: "Toyota",
        model: "Corolla",
        year: 2021,
      },
      parts: [
        {
          sku: "SKU-FULL-DB-1",
          name: "Air Filter",
          description: null,
          quantity: 8,
          unitOfMeasure: null,
          price: 40,
        },
        {
          sku: "SKU-FULL-DB-2",
          name: "Spark Plug",
          description: null,
          quantity: 12,
          unitOfMeasure: null,
          price: 25,
        },
      ],
      services: [
        {
          name: "Revision",
          estimatedTime: 120,
          price: 300,
          requiredParts: [
            { sku: "SKU-FULL-DB-1", quantity: 1 },
            { sku: "SKU-FULL-DB-2", quantity: 2 },
          ],
        },
        {
          name: "Quick Check",
          estimatedTime: 45,
          price: 150,
          requiredParts: [{ sku: "SKU-FULL-DB-2", quantity: 1 }],
        },
      ],
    });

    expect(output.id).not.toBeNull();
    expect(output.status).toBe(WorkOrderStatus.WAITING_APPROVAL);
    expect(output.totalAmount).toBe(565);
    expect(output.serviceTasks).toHaveLength(2);

    const persons = await personRepository.findAll();
    expect(persons).toHaveLength(1);

    const vehicles = await vehicleRepository.findAll();
    expect(vehicles).toHaveLength(1);
    expect(vehicles[0]?.toSnapshot().ownerPersonId).toBe(persons[0]?.toSnapshot().id);

    const parts = await stockItemRepository.findAll();
    expect(parts).toHaveLength(2);

    const services = await serviceRepository.findAll();
    expect(services).toHaveLength(2);
    expect(services.every((service) => service.toSnapshot().requiredItems.length > 0)).toBe(true);

    const serviceTasks = await serviceTaskRepository.findAll();
    expect(serviceTasks).toHaveLength(2);
    expect(serviceTasks.every((task) => task.toSnapshot().workOrderId === output.id)).toBe(true);
  });

  it("returns person document conflict on duplicate work-order opening payload", async () => {
    const { useCase, personRepository } = createFullPayloadUseCase();

    await useCase.execute(
      buildFullPayloadInput({
        document: "52998224725",
        plate: "DOC-1111",
        sku: "SKU-DOC-1",
      }),
    );

    try {
      await useCase.execute(
        buildFullPayloadInput({
          document: "52998224725",
          plate: "DOC-2222",
          sku: "SKU-DOC-2",
        }),
      );
      throw new Error("Expected person document conflict");
    } catch (error) {
      expect(error).toBeInstanceOf(PersonDocumentAlreadyExists);
    }

    const persons = await personRepository.findAll();
    expect(persons).toHaveLength(1);
  });

  it("returns plate conflict on duplicate work-order opening payload", async () => {
    const { useCase, vehicleRepository } = createFullPayloadUseCase();

    await useCase.execute(
      buildFullPayloadInput({
        document: "52998224725",
        plate: "PLT-1111",
        sku: "SKU-PLT-1",
      }),
    );

    try {
      await useCase.execute(
        buildFullPayloadInput({
          document: "16899535009",
          plate: "PLT-1111",
          sku: "SKU-PLT-2",
        }),
      );
      throw new Error("Expected plate conflict");
    } catch (error) {
      expect(error).toBeInstanceOf(PlateAlreadyExists);
    }

    const vehicles = await vehicleRepository.findAll();
    expect(vehicles).toHaveLength(1);
  });

  it("returns sku conflict on duplicate work-order opening payload", async () => {
    const { useCase, stockItemRepository } = createFullPayloadUseCase();

    await useCase.execute(
      buildFullPayloadInput({
        document: "52998224725",
        plate: "SKU-1111",
        sku: "SKU-CONFLICT-1",
      }),
    );

    try {
      await useCase.execute(
        buildFullPayloadInput({
          document: "16899535009",
          plate: "SKU-2222",
          sku: "SKU-CONFLICT-1",
        }),
      );
      throw new Error("Expected SKU conflict");
    } catch (error) {
      expect(error).toBeInstanceOf(SkuAlreadyExists);
    }

    const stockItems = await stockItemRepository.findAll();
    expect(stockItems).toHaveLength(1);
  });

  it("runs the main work order flow end-to-end", async () => {
    const personRepository = new PersonRepositoryPostgres();
    const vehicleRepository = new VehicleRepositoryPostgres();
    const stockItemRepository = new StockItemRepositoryPostgres();
    const serviceRepository = new ServiceRepositoryPostgres();
    const serviceTaskRepository = new ServiceTaskRepositoryPostgres();
    const workOrderRepository = new WorkOrderRepositoryPostgres();

    const createPerson = new CreatePerson(personRepository);
    const createVehicle = new CreateVehicle(vehicleRepository, personRepository);
    const createStockItem = new CreateStockItem(stockItemRepository);
    const createService = new CreateService(serviceRepository, stockItemRepository);
    const approveServiceTask = new ApproveServiceTask(serviceTaskRepository, workOrderRepository);
    const startServiceExecution = new StartServiceExecution(
      serviceTaskRepository,
      serviceRepository,
      stockItemRepository,
      workOrderRepository,
    );
    const completeServiceTask = new CompleteServiceTask(serviceTaskRepository, workOrderRepository);
    const createWorkOrder = new CreateWorkOrder(
      workOrderRepository,
      vehicleRepository,
      serviceTaskRepository,
    );
    const addServiceTask = new AddServiceTask(
      serviceTaskRepository,
      serviceRepository,
      workOrderRepository,
      stockItemRepository,
    );
    const deliverVehicle = new DeliverVehicle(workOrderRepository);

    const person = await createPerson.execute({
      name: "Ana Silva",
      document: "52998224725",
      phone: "+5511999999999",
      email: "ana.silva@example.com",
      role: "customer",
    });

    const vehicle = await createVehicle.execute({
      plate: "ABC-1234",
      brand: "Honda",
      model: "Civic",
      year: 2020,
      ownerPersonId: person.id ?? 0,
    });

    const stockItem = await createStockItem.execute({
      sku: "SKU-FLOW-1",
      name: "Oil Filter",
      description: null,
      quantity: 5,
      unitOfMeasure: null,
      price: 50,
    });

    const service = await createService.execute({
      name: "Oil Change",
      estimatedTime: 60,
      price: 200,
      requiredItems: [
        {
          stockItemId: stockItem.id ?? 0,
          quantity: 1,
        },
      ],
    });

    const workOrder = await createWorkOrder.execute({
      vehicleId: vehicle.id ?? 0,
      serviceTasks: [],
    });

    const workOrderEntityInitial = await workOrderRepository.findById(workOrder.id ?? 0);
    if (!workOrderEntityInitial) {
      throw new Error("Work order must exist after creation");
    }

    // Start diagnosis so new service tasks can be added
    workOrderEntityInitial.startDiagnosis(new Date("2024-01-10T08:10:00.000Z"));
    await workOrderRepository.save(workOrderEntityInitial);

    const serviceTask = await addServiceTask.execute({
      serviceId: service.id ?? 0,
      workOrderId: workOrder.id ?? 0,
    });

    const createdWorkOrder = await workOrderRepository.findById(workOrder.id ?? 0);
    expect(createdWorkOrder).not.toBeNull();
    const createdWorkOrderSnapshot = createdWorkOrder?.toSnapshot();
    expect(createdWorkOrderSnapshot?.totalAmount).toBe(250);

    if (!createdWorkOrder) {
      throw new Error("Work order must exist before completing diagnosis");
    }

    // Complete diagnosis after all tasks have been created
    createdWorkOrder.completeDiagnosis(new Date("2024-01-10T08:20:00.000Z"));
    await workOrderRepository.save(createdWorkOrder);

    await approveServiceTask.execute({
      id: serviceTask.id ?? 0,
      workOrderId: workOrder.id ?? 0,
    });

    await startServiceExecution.execute({
      id: serviceTask.id ?? 0,
      startedAt: new Date("2024-01-10T09:00:00.000Z"),
    });

    const workOrderInExecution = await workOrderRepository.findById(workOrder.id ?? 0);
    if (!workOrderInExecution) {
      throw new Error("Work order must exist after execution start");
    }
    expect(workOrderInExecution.toSnapshot().status).toBe(WorkOrderStatus.IN_EXECUTION);

    await completeServiceTask.execute({ id: serviceTask.id ?? 0 });

    const stockItemAfter = await stockItemRepository.findById(stockItem.id ?? 0);
    if (!stockItemAfter) {
      throw new Error("Stock item must exist after service execution");
    }
    expect(stockItemAfter.toSnapshot().quantity).toBe(4);
    const workOrderAfterCompletion = await workOrderRepository.findById(workOrder.id ?? 0);
    if (!workOrderAfterCompletion) {
      throw new Error("Work order must exist after completion");
    }
    const afterCompletionSnapshot = workOrderAfterCompletion.toSnapshot();
    expect(afterCompletionSnapshot.status).toBe(WorkOrderStatus.FINALIZED);
    expect(afterCompletionSnapshot.totalAmount).toBe(250);

    const delivered = await deliverVehicle.execute({
      id: workOrder.id ?? 0,
      deliveredAt: new Date("2024-01-10T12:00:00.000Z"),
    });

    expect(delivered.status).toBe("DELIVERED");
  });

  it("keeps work order in execution when service task is not in a final execution status", async () => {
    const personRepository = new PersonRepositoryPostgres();
    const vehicleRepository = new VehicleRepositoryPostgres();
    const stockItemRepository = new StockItemRepositoryPostgres();
    const serviceRepository = new ServiceRepositoryPostgres();
    const serviceTaskRepository = new ServiceTaskRepositoryPostgres();
    const workOrderRepository = new WorkOrderRepositoryPostgres();

    const createPerson = new CreatePerson(personRepository);
    const createVehicle = new CreateVehicle(vehicleRepository, personRepository);
    const createStockItem = new CreateStockItem(stockItemRepository);
    const createService = new CreateService(serviceRepository, stockItemRepository);
    const approveServiceTask = new ApproveServiceTask(serviceTaskRepository, workOrderRepository);
    const startServiceExecution = new StartServiceExecution(
      serviceTaskRepository,
      serviceRepository,
      stockItemRepository,
      workOrderRepository,
    );
    const createWorkOrder = new CreateWorkOrder(
      workOrderRepository,
      vehicleRepository,
      serviceTaskRepository,
    );
    const addServiceTask = new AddServiceTask(
      serviceTaskRepository,
      serviceRepository,
      workOrderRepository,
      stockItemRepository,
    );

    const person = await createPerson.execute({
      name: "Carlos Souza",
      document: "16899535009",
      phone: "+5511988887777",
      email: "carlos.souza@example.com",
      role: "customer",
    });

    const vehicle = await createVehicle.execute({
      plate: "FIN-1234",
      brand: "Ford",
      model: "Fiesta",
      year: 2019,
      ownerPersonId: person.id ?? 0,
    });

    const stockItem = await createStockItem.execute({
      sku: "SKU-FIN-1",
      name: "Brake Pad",
      description: null,
      quantity: 10,
      unitOfMeasure: null,
      price: 300,
    });

    const service = await createService.execute({
      name: "Brake Service",
      estimatedTime: 120,
      price: 500,
      requiredItems: [
        {
          stockItemId: stockItem.id ?? 0,
          quantity: 1,
        },
      ],
    });

    const workOrder = await createWorkOrder.execute({
      vehicleId: vehicle.id ?? 0,
      serviceTasks: [],
    });

    const workOrderEntityInitial = await workOrderRepository.findById(workOrder.id ?? 0);
    if (!workOrderEntityInitial) {
      throw new Error("Work order must exist after creation");
    }

    workOrderEntityInitial.startDiagnosis(new Date("2024-01-10T08:10:00.000Z"));
    await workOrderRepository.save(workOrderEntityInitial);

    const serviceTask = await addServiceTask.execute({
      serviceId: service.id ?? 0,
      workOrderId: workOrder.id ?? 0,
    });

    workOrderEntityInitial.completeDiagnosis(new Date("2024-01-10T08:20:00.000Z"));
    await workOrderRepository.save(workOrderEntityInitial);

    await approveServiceTask.execute({
      id: serviceTask.id ?? 0,
      workOrderId: workOrder.id ?? 0,
    });

    await startServiceExecution.execute({
      id: serviceTask.id ?? 0,
      startedAt: new Date("2024-01-10T09:00:00.000Z"),
    });
    // Do NOT complete the service task; keep it IN_EXECUTION

    const workOrderInExecution = await workOrderRepository.findById(workOrder.id ?? 0);
    if (!workOrderInExecution) {
      throw new Error("Work order must exist before checking status");
    }

    const snapshot = workOrderInExecution.toSnapshot();
    expect(snapshot.status).toBe(WorkOrderStatus.IN_EXECUTION);
  });
});
