import type { ServiceTask } from "../aggregate/service-task";

export interface ServiceTaskRepository {
  create(serviceTask: ServiceTask): Promise<ServiceTask>;
  findById(id: number): Promise<ServiceTask | null>;
  findByServiceId(serviceId: number): Promise<ServiceTask[]>;
  findAll(): Promise<ServiceTask[]>;
  save(serviceTask: ServiceTask): Promise<void>;
}
