import { PersonName } from "../value-object/person-name";
import { PersonDocument } from "../value-object/person-document";
import { PersonPhone } from "../value-object/person-phone";
import { PersonEmail } from "../value-object/person-email";
import { PersonRole } from "../value-object/person-role";
import { PersonStatus } from "../value-object/person-status";

export interface PersonSnapshot {
  readonly id: number | null;
  readonly name: string;
  readonly document: string;
  readonly phone: string;
  readonly email: string;
  readonly role: string;
  readonly status: string;
}

export class Person {
  private readonly id: number | null;
  private name: PersonName;
  private document: PersonDocument;
  private phone: PersonPhone;
  private email: PersonEmail;
  private role: PersonRole;
  private status: PersonStatus;

  private constructor(params: {
    id: number | null;
    name: PersonName;
    document: PersonDocument;
    phone: PersonPhone;
    email: PersonEmail;
    role: PersonRole;
    status: PersonStatus;
  }) {
    this.id = params.id;
    this.name = params.name;
    this.document = params.document;
    this.phone = params.phone;
    this.email = params.email;
    this.role = params.role;
    this.status = params.status;
  }

  public static create(params: {
    name: PersonName;
    document: PersonDocument;
    phone: PersonPhone;
    email: PersonEmail;
    role: PersonRole;
    status?: PersonStatus;
  }): Person {
    return new Person({
      id: null,
      name: params.name,
      document: params.document,
      phone: params.phone,
      email: params.email,
      role: params.role,
      status: params.status ?? PersonStatus.ACTIVE,
    });
  }

  public static rehydrate(params: {
    id: number;
    name: PersonName;
    document: PersonDocument;
    phone: PersonPhone;
    email: PersonEmail;
    role: PersonRole;
    status: PersonStatus;
  }): Person {
    return new Person({
      id: params.id,
      name: params.name,
      document: params.document,
      phone: params.phone,
      email: params.email,
      role: params.role,
      status: params.status,
    });
  }

  public update(params: {
    name?: PersonName;
    document?: PersonDocument;
    phone?: PersonPhone;
    email?: PersonEmail;
    role?: PersonRole;
    status?: PersonStatus;
  }): void {
    if (params.name) this.name = params.name;
    if (params.document) this.document = params.document;
    if (params.phone) this.phone = params.phone;
    if (params.email) this.email = params.email;
    if (params.role) this.role = params.role;
    if (params.status) this.status = params.status;
  }

  public toSnapshot(): PersonSnapshot {
    return {
      id: this.id,
      name: this.name.toString(),
      document: this.document.toString(),
      phone: this.phone.toString(),
      email: this.email.toString(),
      role: this.role,
      status: this.status,
    };
  }
}
