import type { Person } from "../aggregate/person";
import type { PersonDocument } from "../value-object/person-document";

export interface PersonRepository {
  create(person: Person): Promise<Person>;
  findById(id: number): Promise<Person | null>;
  findByDocument(document: PersonDocument): Promise<Person | null>;
  findAll(): Promise<Person[]>;
  save(person: Person): Promise<void>;
  delete(id: number): Promise<void>;
}
