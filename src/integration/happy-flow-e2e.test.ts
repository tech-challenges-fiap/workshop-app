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
import { AddServiceTask } from "../application/service-task/add-service-task";
import { ApproveServiceTask } from "../application/service-task/approve-service-task";
import { StartServiceExecution } from "../application/service-task/start-service-execution";
import { CompleteServiceTask } from "../application/service-task/complete-service-task";
import { CreateWorkOrder } from "../application/work-order/create-work-order";
import { DeliverVehicle } from "../application/work-order/deliver-vehicle";
import { ServiceTaskStatus } from "../domain/service-task/value-object/service-task-status";
import { WorkOrderStatus } from "../domain/work-order/value-object/work-order-status";
import type { Notification, NotificationInput } from "../application/notification/notification";

async function resetDatabase(): Promise<void> {
  await pool.query(
    "TRUNCATE TABLE work_orders, service_tasks, service_stock_items, services, vehicles, person, stock_items RESTART IDENTITY CASCADE",
  );
}

class FakeNotification implements Notification {
  public readonly sent: NotificationInput[] = [];

  public async send(input: NotificationInput): Promise<void> {
    this.sent.push(input);
  }
}

describe("Happy flow end-to-end", () => {
  beforeAll(async () => {
    await ensureDatabaseConnection();
    await runMigrations();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("runs the main happy flow and validates state transitions", async () => {
    const personRepository = new PersonRepositoryPostgres();
    const vehicleRepository = new VehicleRepositoryPostgres();
    const stockItemRepository = new StockItemRepositoryPostgres();
    const serviceRepository = new ServiceRepositoryPostgres();
    const serviceTaskRepository = new ServiceTaskRepositoryPostgres();
    const workOrderRepository = new WorkOrderRepositoryPostgres();

    const notification = new FakeNotification();

    const createPerson = new CreatePerson(personRepository);
    const createVehicle = new CreateVehicle(vehicleRepository, personRepository);
    const createStockItem = new CreateStockItem(stockItemRepository);
    const createService = new CreateService(serviceRepository, stockItemRepository);
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
    const approveServiceTask = new ApproveServiceTask(serviceTaskRepository, workOrderRepository);
    const startServiceExecution = new StartServiceExecution(
      serviceTaskRepository,
      serviceRepository,
      stockItemRepository,
      workOrderRepository,
    );
    const completeServiceTask = new CompleteServiceTask(
      serviceTaskRepository,
      workOrderRepository,
      {
        vehicleRepository,
        personRepository,
        notification,
      },
    );
    const deliverVehicle = new DeliverVehicle(workOrderRepository);

    // 1. Criação de cliente (Person)
    const person = await createPerson.execute({
      name: "Ana Silva",
      document: "52998224725",
      phone: "+5511999999999",
      email: "ana.silva@example.com",
      role: "customer",
    });

    expect(person.id).not.toBeNull();

    // 2. Criação de veículo vinculado ao cliente (Vehicle)
    const vehicle = await createVehicle.execute({
      plate: "ABC-1234",
      brand: "Honda",
      model: "Civic",
      year: 2020,
      ownerPersonId: person.id ?? 0,
    });

    expect(vehicle.id).not.toBeNull();

    // 3. Criação de item de estoque (StockItem)
    const stockItem = await createStockItem.execute({
      sku: "SKU-HAPPY-1",
      name: "Oil Filter",
      description: null,
      quantity: 5,
      unitOfMeasure: null,
      price: 50,
    });

    expect(stockItem.id).not.toBeNull();
    expect(stockItem.quantity).toBe(5);

    // 4. Criação de serviço que consome item de estoque (Service)
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

    expect(service.id).not.toBeNull();

    // 5. Criação de ordem de serviço (WorkOrder)
    const workOrder = await createWorkOrder.execute({
      vehicleId: vehicle.id ?? 0,
      serviceTasks: [],
    });

    expect(workOrder.id).not.toBeNull();
    expect(workOrder.status).toBe(WorkOrderStatus.RECEIVED);

    const workOrderId = workOrder.id ?? 0;

    const workOrderEntityInitial = await workOrderRepository.findById(workOrderId);
    if (!workOrderEntityInitial) {
      throw new Error("Work order must exist after creation");
    }

    // 6. Início do diagnóstico (WorkOrder)
    const diagnosisStartAt = new Date("2024-01-10T08:10:00.000Z");
    workOrderEntityInitial.startDiagnosis(diagnosisStartAt);
    const afterStartDiagnosis = workOrderEntityInitial.toSnapshot();
    expect(afterStartDiagnosis.status).toBe(WorkOrderStatus.DIAGNOSIS);

    await workOrderRepository.save(workOrderEntityInitial);

    // 7. Criação de tarefa de serviço que consome item de estoque (ServiceTask)
    const serviceTask = await addServiceTask.execute({
      serviceId: service.id ?? 0,
      workOrderId,
    });

    expect(serviceTask.id).not.toBeNull();
    expect(serviceTask.status).toBe(ServiceTaskStatus.PENDING_APPROVAL);

    // 8. Conclusão do diagnóstico (WorkOrder)
    const diagnosisCompleteAt = new Date("2024-01-10T08:20:00.000Z");
    workOrderEntityInitial.completeDiagnosis(diagnosisCompleteAt);
    await workOrderRepository.save(workOrderEntityInitial);

    const afterCompleteDiagnosis = workOrderEntityInitial.toSnapshot();
    expect(afterCompleteDiagnosis.status).toBe(WorkOrderStatus.WAITING_APPROVAL);

    // 9. Aprovação da ServiceTask (ServiceTask)
    await approveServiceTask.execute({
      id: serviceTask.id ?? 0,
      workOrderId,
    });

    const approvedServiceTask = await serviceTaskRepository.findById(serviceTask.id ?? 0);
    if (!approvedServiceTask) {
      throw new Error("Service task must exist after approval");
    }
    expect(approvedServiceTask.toSnapshot().status).toBe(ServiceTaskStatus.APPROVED);

    const workOrderAfterApproval = await workOrderRepository.findById(workOrderId);
    if (!workOrderAfterApproval) {
      throw new Error("Work order must exist after service task approval");
    }
    expect(workOrderAfterApproval.toSnapshot().status).toBe(WorkOrderStatus.READY);

    // 10. Início da execução (WorkOrder + ServiceTask)
    const executionStartAt = new Date("2024-01-10T09:00:00.000Z");
    await startServiceExecution.execute({ id: serviceTask.id ?? 0, startedAt: executionStartAt });

    const workOrderAfterExecution = await workOrderRepository.findById(workOrderId);
    if (!workOrderAfterExecution) {
      throw new Error("Work order must exist after execution start");
    }
    expect(workOrderAfterExecution.toSnapshot().status).toBe(WorkOrderStatus.IN_EXECUTION);

    const inExecutionServiceTask = await serviceTaskRepository.findById(serviceTask.id ?? 0);
    if (!inExecutionServiceTask) {
      throw new Error("Service task must exist after starting execution");
    }
    const inExecutionSnapshot = inExecutionServiceTask.toSnapshot();
    expect(inExecutionSnapshot.status).toBe(ServiceTaskStatus.IN_EXECUTION);
    expect(inExecutionSnapshot.startedAt).not.toBeNull();

    // 11. Conclusão da execução (ServiceTask)
    await completeServiceTask.execute({ id: serviceTask.id ?? 0 });

    const completedServiceTask = await serviceTaskRepository.findById(serviceTask.id ?? 0);
    if (!completedServiceTask) {
      throw new Error("Service task must exist after completion");
    }
    const completedSnapshot = completedServiceTask.toSnapshot();
    expect(completedSnapshot.status).toBe(ServiceTaskStatus.COMPLETED);
    expect(completedSnapshot.completedAt).not.toBeNull();

    // Sincronizar estado da ServiceTask na WorkOrder
    const workOrderInExecution = await workOrderRepository.findById(workOrderId);
    if (!workOrderInExecution) {
      throw new Error("Work order must exist before updating service task status");
    }

    const workOrderAfterCompletion = await workOrderRepository.findById(workOrderId);
    if (!workOrderAfterCompletion) {
      throw new Error("Work order must exist after service task completion");
    }
    expect(workOrderAfterCompletion.toSnapshot().status).toBe(WorkOrderStatus.FINALIZED);

    expect(notification.sent).toHaveLength(1);
    const parsedNotification = JSON.parse(notification.sent[0]?.message ?? "{}");
    expect(parsedNotification.event).toBe("work_order_finalized");
    expect(parsedNotification.workOrder?.id).toBe(workOrderId);

    // 12. Consumo de estoque e verificação de quantidade
    const stockItemAfter = await stockItemRepository.findById(stockItem.id ?? 0);
    if (!stockItemAfter) {
      throw new Error("Stock item must exist after service execution");
    }
    expect(stockItemAfter.toSnapshot().quantity).toBe(4);

    // 13. Finalização da OS (WorkOrder)
    // 14. Entrega do veículo ao cliente (WorkOrder)
    const delivered = await deliverVehicle.execute({
      id: workOrderId,
      deliveredAt: new Date("2024-01-10T12:00:00.000Z"),
    });

    expect(delivered.status).toBe(WorkOrderStatus.DELIVERED);
  });
});
