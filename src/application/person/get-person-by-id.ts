import type { Person } from "../../domain/person/aggregate/person";
import { PersonNotFound } from "../../domain/person/domain-error/person-not-found";
import type { PersonRepository } from "../../domain/person/repository/person-repository";

export interface GetPersonByIdInput {
  id: number;
}

export type GetPersonByIdOutput = ReturnType<Person["toSnapshot"]>;

export class GetPersonById {
  constructor(private readonly personRepository: PersonRepository) {}

  public async execute(input: GetPersonByIdInput): Promise<GetPersonByIdOutput> {
    const person = await this.personRepository.findById(input.id);

    if (!person) {
      throw new PersonNotFound(String(input.id));
    }

    return person.toSnapshot();
  }
}
