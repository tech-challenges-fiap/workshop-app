import type { AppRuntimeConfig } from "./config";
import type { InfrastructureDeps } from "./build-infrastructure";
import { LoginAdmin } from "../application/auth/login-admin";
import { CreateStockItem } from "../application/stock-item/create-stock-item";
import { IncreaseStockItemQuantity } from "../application/stock-item/increase-stock-item-quantity";
import { ConsumeStockItemQuantity } from "../application/stock-item/consume-stock-item-quantity";
import { GetStockItemById } from "../application/stock-item/get-stock-item-by-id";
import { ListStockItems } from "../application/stock-item/list-stock-items";
import { UpdateStockItem } from "../application/stock-item/update-stock-item";
import { DeleteStockItem } from "../application/stock-item/delete-stock-item";
import { CreateService } from "../application/service/create-service";
import { GetServiceById } from "../application/service/get-service-by-id";
import { GetServiceAverageDuration } from "../application/service/get-service-average-duration";
import { ListServices } from "../application/service/list-services";
import { UpdateService } from "../application/service/update-service";
import { DeleteService } from "../application/service/delete-service";
import { AddServiceTask } from "../application/service-task/add-service-task";
import { ApproveServiceTask } from "../application/service-task/approve-service-task";
import { ApproveServiceTaskByPublicToken } from "../application/service-task/approve-service-task-by-public-token";
import { RejectServiceTask } from "../application/service-task/reject-service-task";
import { RejectServiceTaskByPublicToken } from "../application/service-task/reject-service-task-by-public-token";
import { StartServiceExecution } from "../application/service-task/start-service-execution";
import { CompleteServiceTask } from "../application/service-task/complete-service-task";
import { GetServiceTaskById } from "../application/service-task/get-service-task-by-id";
import { ListServiceTasks } from "../application/service-task/list-service-tasks";
import { CreateVehicle } from "../application/vehicle/create-vehicle";
import { GetVehicleById } from "../application/vehicle/get-vehicle-by-id";
import { ListVehicles } from "../application/vehicle/list-vehicles";
import { GetVehicleByPlate } from "../application/vehicle/get-vehicle-by-plate";
import { UpdateVehicle } from "../application/vehicle/update-vehicle";
import { DeleteVehicle } from "../application/vehicle/delete-vehicle";
import { CreatePerson } from "../application/person/create-person";
import { GetPersonById } from "../application/person/get-person-by-id";
import { ListPersons } from "../application/person/list-persons";
import { UpdatePerson } from "../application/person/update-person";
import { DeletePerson } from "../application/person/delete-person";
import { CreateWorkOrderWithFullPayload } from "../application/work-order/create-work-order-with-full-payload";
import { GetWorkOrderById } from "../application/work-order/get-work-order-by-id";
import { ListWorkOrders } from "../application/work-order/list-work-orders";
import { CancelWorkOrder } from "../application/work-order/cancel-work-order";
import { DeliverVehicle } from "../application/work-order/deliver-vehicle";
import { GetWorkOrderByPublicToken } from "../application/work-order/get-work-order-by-public-token";
import { StartDiagnosis } from "../application/work-order/start-diagnosis";
import { CompleteDiagnosis } from "../application/work-order/complete-diagnosis";
import { GetWorkOrderStatusDurationMetrics } from "../application/work-order/get-work-order-status-duration-metrics";
import { HandleExternalWorkOrderEvent } from "../application/work-order/handle-external-work-order-event";
import { CreateWorkOrderWithFullPayloadUnitOfWorkPostgres } from "../infrastructure/work-order/create-work-order-with-full-payload-unit-of-work-postgres";

export interface ApplicationDeps {
  auth: {
    loginAdmin: LoginAdmin;
  };
  stockItems: {
    createStockItem: CreateStockItem;
    increaseStockItemQuantity: IncreaseStockItemQuantity;
    consumeStockItemQuantity: ConsumeStockItemQuantity;
    getStockItemById: GetStockItemById;
    listStockItems: ListStockItems;
    updateStockItem: UpdateStockItem;
    deleteStockItem: DeleteStockItem;
  };
  services: {
    createService: CreateService;
    getServiceById: GetServiceById;
    getServiceAverageDuration: GetServiceAverageDuration;
    listServices: ListServices;
    updateService: UpdateService;
    deleteService: DeleteService;
  };
  serviceTasks: {
    addServiceTask: AddServiceTask;
    approveServiceTask: ApproveServiceTask;
    approveServiceTaskByPublicToken: ApproveServiceTaskByPublicToken;
    rejectServiceTask: RejectServiceTask;
    rejectServiceTaskByPublicToken: RejectServiceTaskByPublicToken;
    startServiceExecution: StartServiceExecution;
    completeServiceTask: CompleteServiceTask;
    getServiceTaskById: GetServiceTaskById;
    listServiceTasks: ListServiceTasks;
  };
  vehicles: {
    createVehicle: CreateVehicle;
    getVehicleById: GetVehicleById;
    listVehicles: ListVehicles;
    getVehicleByPlate: GetVehicleByPlate;
    updateVehicle: UpdateVehicle;
    deleteVehicle: DeleteVehicle;
  };
  person: {
    createPerson: CreatePerson;
    getPersonById: GetPersonById;
    listPersons: ListPersons;
    updatePerson: UpdatePerson;
    deletePerson: DeletePerson;
  };
  workOrders: {
    createWorkOrder: CreateWorkOrderWithFullPayload;
    getWorkOrderById: GetWorkOrderById;
    listWorkOrders: ListWorkOrders;
    cancelWorkOrder: CancelWorkOrder;
    deliverVehicle: DeliverVehicle;
    getWorkOrderByPublicToken: GetWorkOrderByPublicToken;
    startDiagnosis: StartDiagnosis;
    completeDiagnosis: CompleteDiagnosis;
    getStatusDurationMetrics: GetWorkOrderStatusDurationMetrics;
  };
  webhooks: {
    handleExternalWorkOrderEvent: HandleExternalWorkOrderEvent;
  };
}

const DEFAULT_PUBLIC_BASE_URL = "http://localhost:8080";

export function buildApplicationDeps(
  infra: InfrastructureDeps,
  config: AppRuntimeConfig,
): ApplicationDeps {
  return {
    auth: {
      loginAdmin: new LoginAdmin(config.adminUsername, config.adminPassword),
    },
    stockItems: {
      createStockItem: new CreateStockItem(infra.stockItemRepository),
      increaseStockItemQuantity: new IncreaseStockItemQuantity(infra.stockItemRepository),
      consumeStockItemQuantity: new ConsumeStockItemQuantity(infra.stockItemRepository),
      getStockItemById: new GetStockItemById(infra.stockItemRepository),
      listStockItems: new ListStockItems(infra.stockItemRepository),
      updateStockItem: new UpdateStockItem(infra.stockItemRepository),
      deleteStockItem: new DeleteStockItem(infra.stockItemRepository),
    },
    services: {
      createService: new CreateService(infra.serviceRepository, infra.stockItemRepository),
      getServiceById: new GetServiceById(infra.serviceRepository),
      getServiceAverageDuration: new GetServiceAverageDuration(
        infra.serviceRepository,
        infra.serviceTaskRepository,
      ),
      listServices: new ListServices(infra.serviceRepository),
      updateService: new UpdateService(infra.serviceRepository, infra.stockItemRepository),
      deleteService: new DeleteService(infra.serviceRepository),
    },
    serviceTasks: {
      addServiceTask: new AddServiceTask(
        infra.serviceTaskRepository,
        infra.serviceRepository,
        infra.workOrderRepository,
        infra.stockItemRepository,
      ),
      approveServiceTask: new ApproveServiceTask(
        infra.serviceTaskRepository,
        infra.workOrderRepository,
      ),
      approveServiceTaskByPublicToken: new ApproveServiceTaskByPublicToken(
        infra.serviceTaskRepository,
        infra.workOrderRepository,
      ),
      rejectServiceTask: new RejectServiceTask(
        infra.serviceTaskRepository,
        infra.workOrderRepository,
      ),
      rejectServiceTaskByPublicToken: new RejectServiceTaskByPublicToken(
        infra.serviceTaskRepository,
        infra.workOrderRepository,
      ),
      startServiceExecution: new StartServiceExecution(
        infra.serviceTaskRepository,
        infra.serviceRepository,
        infra.stockItemRepository,
        infra.workOrderRepository,
      ),
      completeServiceTask: new CompleteServiceTask(
        infra.serviceTaskRepository,
        infra.workOrderRepository,
        {
          vehicleRepository: infra.vehicleRepository,
          personRepository: infra.personRepository,
          notification: infra.notification,
        },
      ),
      getServiceTaskById: new GetServiceTaskById(infra.serviceTaskRepository),
      listServiceTasks: new ListServiceTasks(infra.serviceTaskRepository),
    },
    vehicles: {
      createVehicle: new CreateVehicle(infra.vehicleRepository, infra.personRepository),
      getVehicleById: new GetVehicleById(infra.vehicleRepository),
      listVehicles: new ListVehicles(infra.vehicleRepository),
      getVehicleByPlate: new GetVehicleByPlate(infra.vehicleRepository),
      updateVehicle: new UpdateVehicle(infra.vehicleRepository, infra.personRepository),
      deleteVehicle: new DeleteVehicle(infra.vehicleRepository),
    },
    person: {
      createPerson: new CreatePerson(infra.personRepository),
      getPersonById: new GetPersonById(infra.personRepository),
      listPersons: new ListPersons(infra.personRepository),
      updatePerson: new UpdatePerson(infra.personRepository),
      deletePerson: new DeletePerson(infra.personRepository),
    },
    workOrders: {
      createWorkOrder: new CreateWorkOrderWithFullPayload(
        {
          personRepository: infra.personRepository,
          vehicleRepository: infra.vehicleRepository,
          stockItemRepository: infra.stockItemRepository,
          serviceRepository: infra.serviceRepository,
          serviceTaskRepository: infra.serviceTaskRepository,
          workOrderRepository: infra.workOrderRepository,
        },
        new CreateWorkOrderWithFullPayloadUnitOfWorkPostgres(),
      ),
      getWorkOrderById: new GetWorkOrderById(infra.workOrderRepository),
      listWorkOrders: new ListWorkOrders(infra.workOrderRepository),
      cancelWorkOrder: new CancelWorkOrder(infra.workOrderRepository),
      deliverVehicle: new DeliverVehicle(infra.workOrderRepository),
      getWorkOrderByPublicToken: new GetWorkOrderByPublicToken(infra.workOrderRepository),
      startDiagnosis: new StartDiagnosis(infra.workOrderRepository),
      getStatusDurationMetrics: new GetWorkOrderStatusDurationMetrics(infra.workOrderRepository),
      completeDiagnosis: new CompleteDiagnosis(infra.workOrderRepository, {
        vehicleRepository: infra.vehicleRepository,
        personRepository: infra.personRepository,
        serviceTaskRepository: infra.serviceTaskRepository,
        serviceRepository: infra.serviceRepository,
        stockItemRepository: infra.stockItemRepository,
        notification: infra.notification,
        publicBaseUrl: DEFAULT_PUBLIC_BASE_URL,
      }),
    },
    webhooks: {
      handleExternalWorkOrderEvent: new HandleExternalWorkOrderEvent({
        approveServiceTask: new ApproveServiceTask(
          infra.serviceTaskRepository,
          infra.workOrderRepository,
        ),
        rejectServiceTask: new RejectServiceTask(
          infra.serviceTaskRepository,
          infra.workOrderRepository,
        ),
        startServiceExecution: new StartServiceExecution(
          infra.serviceTaskRepository,
          infra.serviceRepository,
          infra.stockItemRepository,
          infra.workOrderRepository,
        ),
        completeServiceTask: new CompleteServiceTask(
          infra.serviceTaskRepository,
          infra.workOrderRepository,
          {
            vehicleRepository: infra.vehicleRepository,
            personRepository: infra.personRepository,
            notification: infra.notification,
          },
        ),
        startDiagnosis: new StartDiagnosis(infra.workOrderRepository),
        completeDiagnosis: new CompleteDiagnosis(infra.workOrderRepository, {
          vehicleRepository: infra.vehicleRepository,
          personRepository: infra.personRepository,
          serviceTaskRepository: infra.serviceTaskRepository,
          serviceRepository: infra.serviceRepository,
          stockItemRepository: infra.stockItemRepository,
          notification: infra.notification,
          publicBaseUrl: DEFAULT_PUBLIC_BASE_URL,
        }),
        cancelWorkOrder: new CancelWorkOrder(infra.workOrderRepository),
        deliverVehicle: new DeliverVehicle(infra.workOrderRepository),
        workOrderWebhookEventRepository: infra.workOrderWebhookEventRepository,
      }),
    },
  };
}
