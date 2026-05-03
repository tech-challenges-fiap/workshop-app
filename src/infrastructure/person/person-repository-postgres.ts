import { eq } from "drizzle-orm";

import { db } from "../db";
import { person } from "../db/schema/person";
import { Person } from "../../domain/person/aggregate/person";
import { PersonName } from "../../domain/person/value-object/person-name";
import { PersonDocument } from "../../domain/person/value-object/person-document";
import { PersonPhone } from "../../domain/person/value-object/person-phone";
import { PersonEmail } from "../../domain/person/value-object/person-email";
import { assertPersonRole } from "../../domain/person/value-object/person-role";
import { assertPersonStatus } from "../../domain/person/value-object/person-status";
import type { PersonRepository } from "../../domain/person/repository/person-repository";
import { PersonDocumentAlreadyExists } from "../../domain/person/domain-error/person-document-already-exists";

type QueryExecutor = Pick<typeof db, "insert" | "select" | "update" | "delete">;

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as { code?: unknown; cause?: unknown };

  if (candidate.code === "23505") {
    return true;
  }

  if (candidate.cause && typeof candidate.cause === "object") {
    const causeWithCode = candidate.cause as { code?: unknown };
    if (causeWithCode.code === "23505") {
      return true;
    }
  }

  return false;
}

export class PersonRepositoryPostgres implements PersonRepository {
  constructor(private readonly queryExecutor: QueryExecutor = db) {}

  public async create(entity: Person): Promise<Person> {
    const snapshot = entity.toSnapshot();

    try {
      const [row] = await this.queryExecutor
        .insert(person)
        .values({
          name: snapshot.name,
          document: snapshot.document,
          phone: snapshot.phone,
          email: snapshot.email,
          role: snapshot.role,
          status: snapshot.status,
        })
        .returning();

      return Person.rehydrate({
        id: row.id,
        name: PersonName.create(row.name),
        document: PersonDocument.create(row.document),
        phone: PersonPhone.create(row.phone),
        email: PersonEmail.create(row.email),
        role: assertPersonRole(row.role),
        status: assertPersonStatus(row.status),
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new PersonDocumentAlreadyExists(snapshot.document);
      }
      throw error;
    }
  }

  public async findById(id: number): Promise<Person | null> {
    const [row] = await this.queryExecutor.select().from(person).where(eq(person.id, id));

    if (!row) {
      return null;
    }

    return Person.rehydrate({
      id: row.id,
      name: PersonName.create(row.name),
      document: PersonDocument.create(row.document),
      phone: PersonPhone.create(row.phone),
      email: PersonEmail.create(row.email),
      role: assertPersonRole(row.role),
      status: assertPersonStatus(row.status),
    });
  }

  public async findByDocument(document: PersonDocument): Promise<Person | null> {
    const [row] = await this.queryExecutor
      .select()
      .from(person)
      .where(eq(person.document, document.toString()));

    if (!row) {
      return null;
    }

    return Person.rehydrate({
      id: row.id,
      name: PersonName.create(row.name),
      document: PersonDocument.create(row.document),
      phone: PersonPhone.create(row.phone),
      email: PersonEmail.create(row.email),
      role: assertPersonRole(row.role),
      status: assertPersonStatus(row.status),
    });
  }

  public async findAll(): Promise<Person[]> {
    const rows = await this.queryExecutor.select().from(person);

    return rows.map((row) =>
      Person.rehydrate({
        id: row.id,
        name: PersonName.create(row.name),
        document: PersonDocument.create(row.document),
        phone: PersonPhone.create(row.phone),
        email: PersonEmail.create(row.email),
        role: assertPersonRole(row.role),
        status: assertPersonStatus(row.status),
      }),
    );
  }

  public async save(entity: Person): Promise<void> {
    const snapshot = entity.toSnapshot();

    if (!snapshot.id) {
      throw new Error("Cannot save person without ID");
    }

    try {
      await this.queryExecutor
        .update(person)
        .set({
          name: snapshot.name,
          document: snapshot.document,
          phone: snapshot.phone,
          email: snapshot.email,
          role: snapshot.role,
          status: snapshot.status,
        })
        .where(eq(person.id, snapshot.id));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new PersonDocumentAlreadyExists(snapshot.document);
      }
      throw error;
    }
  }

  public async delete(id: number): Promise<void> {
    await this.queryExecutor.delete(person).where(eq(person.id, id));
  }
}
