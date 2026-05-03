import type { Service } from "../aggregate/service";

export interface ServiceRepository {
  create(service: Service): Promise<Service>;
  findById(id: number): Promise<Service | null>;
  findAll(): Promise<Service[]>;
  save(service: Service): Promise<void>;
  delete(id: number): Promise<void>;
}
