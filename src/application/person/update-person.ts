import type { Person } from "../../domain/person/aggregate/person";
import { PersonName } from "../../domain/person/value-object/person-name";
import { PersonDocument } from "../../domain/person/value-object/person-document";
import { PersonPhone } from "../../domain/person/value-object/person-phone";
import { PersonEmail } from "../../domain/person/value-object/person-email";
import { PersonRole, assertPersonRole } from "../../domain/person/value-object/person-role";
import { PersonStatus, assertPersonStatus } from "../../domain/person/value-object/person-status";
import { PersonNotFound } from "../../domain/person/domain-error/person-not-found";
import { PersonDocumentAlreadyExists } from "../../domain/person/domain-error/person-document-already-exists";
import type { PersonRepository } from "../../domain/person/repository/person-repository";

export interface UpdatePersonInput {
  id: number;
  name?: string;
  document?: string;
  phone?: string;
  email?: string;
  role?: string;
  status?: string;
}

export type UpdatePersonOutput = ReturnType<Person["toSnapshot"]>;

export class UpdatePerson {
  constructor(private readonly personRepository: PersonRepository) {}

  public async execute(input: UpdatePersonInput): Promise<UpdatePersonOutput> {
    const person = await this.personRepository.findById(input.id);

    if (!person) {
      throw new PersonNotFound(String(input.id));
    }

    const currentSnapshot = person.toSnapshot();

    let newDocument: PersonDocument | undefined;

    if (input.document) {
      newDocument = PersonDocument.create(input.document);
      if (newDocument.toString() !== currentSnapshot.document) {
        const conflict = await this.personRepository.findByDocument(newDocument);
        if (conflict && conflict.toSnapshot().id !== input.id) {
          throw new PersonDocumentAlreadyExists(newDocument.toString());
        }
      }
    }

    let newRole: PersonRole | undefined;
    if (typeof input.role === "string") {
      newRole = assertPersonRole(input.role);
    }

    let newStatus: PersonStatus | undefined;
    if (typeof input.status === "string") {
      newStatus = assertPersonStatus(input.status);
    }

    person.update({
      name: input.name ? PersonName.create(input.name) : undefined,
      document: newDocument,
      phone: input.phone ? PersonPhone.create(input.phone) : undefined,
      email: input.email ? PersonEmail.create(input.email) : undefined,
      role: newRole,
      status: newStatus,
    });

    await this.personRepository.save(person);

    return person.toSnapshot();
  }
}
