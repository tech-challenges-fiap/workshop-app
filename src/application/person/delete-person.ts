import { PersonNotFound } from "../../domain/person/domain-error/person-not-found";
import type { PersonRepository } from "../../domain/person/repository/person-repository";

export interface DeletePersonInput {
  id: number;
}

export class DeletePerson {
  constructor(private readonly personRepository: PersonRepository) {}

  public async execute(input: DeletePersonInput): Promise<void> {
    const person = await this.personRepository.findById(input.id);

    if (!person) {
      throw new PersonNotFound(String(input.id));
    }

    await this.personRepository.delete(input.id);
  }
}
