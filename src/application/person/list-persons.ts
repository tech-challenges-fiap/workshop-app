import type { Person } from "../../domain/person/aggregate/person";
import type { PersonRepository } from "../../domain/person/repository/person-repository";

export type ListPersonsOutput = ReturnType<Person["toSnapshot"]>[];

export class ListPersons {
  constructor(private readonly personRepository: PersonRepository) {}

  public async execute(): Promise<ListPersonsOutput> {
    const persons = await this.personRepository.findAll();
    return persons.map((person) => person.toSnapshot());
  }
}
