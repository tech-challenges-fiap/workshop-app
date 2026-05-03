import type {
  CreateWorkOrderWithFullPayloadDependencies,
  CreateWorkOrderWithFullPayloadUnitOfWork,
} from "../../application/work-order/create-work-order-with-full-payload";
import { db } from "../db";
import { PersonRepositoryPostgres } from "../person/person-repository-postgres";
import { VehicleRepositoryPostgres } from "../vehicle/vehicle-repository-postgres";
import { StockItemRepositoryPostgres } from "../stock-item/stock-item-repository-postgres";
import { ServiceRepositoryPostgres } from "../service/service-repository-postgres";
import { ServiceTaskRepositoryPostgres } from "../service-task/service-task-repository-postgres";
import { WorkOrderRepositoryPostgres } from "./work-order-repository-postgres";

export class CreateWorkOrderWithFullPayloadUnitOfWorkPostgres implements CreateWorkOrderWithFullPayloadUnitOfWork {
  public async run<T>(
    operation: (deps: CreateWorkOrderWithFullPayloadDependencies) => Promise<T>,
  ): Promise<T> {
    return db.transaction(async (tx) => {
      const deps: CreateWorkOrderWithFullPayloadDependencies = {
        personRepository: new PersonRepositoryPostgres(tx),
        vehicleRepository: new VehicleRepositoryPostgres(tx),
        stockItemRepository: new StockItemRepositoryPostgres(tx),
        serviceRepository: new ServiceRepositoryPostgres(tx),
        serviceTaskRepository: new ServiceTaskRepositoryPostgres(tx),
        workOrderRepository: new WorkOrderRepositoryPostgres(tx),
      };

      return operation(deps);
    });
  }
}
