import { Person } from "../../domain/person/aggregate/person";
import { PersonName } from "../../domain/person/value-object/person-name";
import { PersonDocument } from "../../domain/person/value-object/person-document";
import { PersonPhone } from "../../domain/person/value-object/person-phone";
import { PersonEmail } from "../../domain/person/value-object/person-email";
import { assertPersonRole } from "../../domain/person/value-object/person-role";
import { assertPersonStatus, PersonStatus } from "../../domain/person/value-object/person-status";
import type { PersonRepository } from "../../domain/person/repository/person-repository";
import { PersonDocumentAlreadyExists } from "../../domain/person/domain-error/person-document-already-exists";

export interface CreatePersonInput {
  name: string;
  document: string;
  phone: string;
  email: string;
  role: string;
  status?: string;
}

export type CreatePersonOutput = ReturnType<Person["toSnapshot"]>;

export class CreatePerson {
  constructor(private readonly personRepository: PersonRepository) {}

  public async execute(input: CreatePersonInput): Promise<CreatePersonOutput> {
    const name = PersonName.create(input.name);
    const document = PersonDocument.create(input.document);
    const phone = PersonPhone.create(input.phone);
    const email = PersonEmail.create(input.email);
    const role = assertPersonRole(input.role);
    const status = input.status ? assertPersonStatus(input.status) : PersonStatus.ACTIVE;

    const existing = await this.personRepository.findByDocument(document);
    if (existing) {
      throw new PersonDocumentAlreadyExists(document.toString());
    }

    const person = Person.create({
      name,
      document,
      phone,
      email,
      role,
      status,
    });

    const created = await this.personRepository.create(person);

    return created.toSnapshot();
  }
}
