import { beforeAll, beforeEach, describe, expect, it } from "bun:test";

import { ensureDatabaseConnection, pool } from "../db";
import { runMigrations } from "../db/migrate";
import { person as personTable } from "../db/schema/person";
import { db } from "../db";
import { PersonRepositoryPostgres } from "./person-repository-postgres";
import { Person } from "../../domain/person/aggregate/person";
import { PersonName } from "../../domain/person/value-object/person-name";
import { PersonDocument } from "../../domain/person/value-object/person-document";
import { PersonPhone } from "../../domain/person/value-object/person-phone";
import { PersonEmail } from "../../domain/person/value-object/person-email";
import { PersonRole } from "../../domain/person/value-object/person-role";
import { PersonDocumentAlreadyExists } from "../../domain/person/domain-error/person-document-already-exists";

async function resetPersonTable(): Promise<void> {
  await pool.query("TRUNCATE TABLE person RESTART IDENTITY CASCADE");
}

describe("PersonRepositoryPostgres", () => {
  const repository = new PersonRepositoryPostgres();

  beforeAll(async () => {
    await ensureDatabaseConnection();
    await runMigrations();
  });

  beforeEach(async () => {
    await resetPersonTable();
  });

  it("creates and finds a person by id and document", async () => {
    const person = Person.create({
      name: PersonName.create("John Doe"),
      document: PersonDocument.create("52998224725"),
      phone: PersonPhone.create("+5511999999999"),
      email: PersonEmail.create("john@example.com"),
      role: PersonRole.CUSTOMER,
    });

    const created = await repository.create(person);
    const snapshot = created.toSnapshot();

    expect(snapshot.id).not.toBeNull();

    const byId = await repository.findById(snapshot.id!);
    expect(byId?.toSnapshot()).toMatchObject({
      name: "John Doe",
      document: "52998224725",
    });

    const byDocument = await repository.findByDocument(PersonDocument.create("52998224725"));
    expect(byDocument?.toSnapshot()).toMatchObject({
      email: "john@example.com",
    });
  });

  it("lists all persons", async () => {
    const person1 = Person.create({
      name: PersonName.create("Alice"),
      document: PersonDocument.create("11144477735"),
      phone: PersonPhone.create("+5511999991111"),
      email: PersonEmail.create("alice@example.com"),
      role: PersonRole.CUSTOMER,
    });

    const person2 = Person.create({
      name: PersonName.create("Bob"),
      document: PersonDocument.create("93541134780"),
      phone: PersonPhone.create("+5511999992222"),
      email: PersonEmail.create("bob@example.com"),
      role: PersonRole.CUSTOMER,
    });

    await repository.create(person1);
    await repository.create(person2);

    const all = await repository.findAll();
    expect(all).toHaveLength(2);
    const docs = all.map((p) => p.toSnapshot().document).sort();
    expect(docs).toEqual(["11144477735", "93541134780"]);
  });

  it("updates a person and persists changes", async () => {
    const person = Person.create({
      name: PersonName.create("Carol"),
      document: PersonDocument.create("12345678909"),
      phone: PersonPhone.create("+5511999993333"),
      email: PersonEmail.create("carol@example.com"),
      role: PersonRole.CUSTOMER,
    });

    const created = await repository.create(person);
    const snapshot = created.toSnapshot();

    const aggregate = Person.rehydrate({
      id: snapshot.id!,
      name: PersonName.create("Carol Updated"),
      document: PersonDocument.create("12345678909"),
      phone: PersonPhone.create("+5511999993333"),
      email: PersonEmail.create("carol.updated@example.com"),
      role: PersonRole.CUSTOMER,
    });

    await repository.save(aggregate);

    const reloaded = await repository.findById(snapshot.id!);
    expect(reloaded?.toSnapshot()).toMatchObject({
      name: "Carol Updated",
      email: "carol.updated@example.com",
    });
  });

  it("throws domain error on duplicate document on create", async () => {
    const base = Person.create({
      name: PersonName.create("Dave"),
      document: PersonDocument.create("35795145637"),
      phone: PersonPhone.create("+5511999994444"),
      email: PersonEmail.create("dave@example.com"),
      role: PersonRole.CUSTOMER,
    });

    await repository.create(base);

    const duplicate = Person.create({
      name: PersonName.create("Other Dave"),
      document: PersonDocument.create("35795145637"),
      phone: PersonPhone.create("+5511999995555"),
      email: PersonEmail.create("other@example.com"),
      role: PersonRole.CUSTOMER,
    });

    expect(repository.create(duplicate)).rejects.toBeInstanceOf(PersonDocumentAlreadyExists);
  });

  it("throws domain error on duplicate document on save", async () => {
    const p1 = Person.create({
      name: PersonName.create("Eve"),
      document: PersonDocument.create("93541134780"),
      phone: PersonPhone.create("+5511999995555"),
      email: PersonEmail.create("eve@example.com"),
      role: PersonRole.CUSTOMER,
    });

    const p2 = Person.create({
      name: PersonName.create("Frank"),
      document: PersonDocument.create("16899535009"),
      phone: PersonPhone.create("+5511999996666"),
      email: PersonEmail.create("frank@example.com"),
      role: PersonRole.CUSTOMER,
    });

    const created1 = await repository.create(p1);
    const created2 = await repository.create(p2);

    const snap2 = created2.toSnapshot();
    const updated2 = Person.rehydrate({
      id: snap2.id!,
      name: PersonName.create("Frank"),
      document: PersonDocument.create("93541134780"),
      phone: PersonPhone.create("+5511999996666"),
      email: PersonEmail.create("frank@example.com"),
      role: PersonRole.CUSTOMER,
    });

    void created1;

    expect(repository.save(updated2)).rejects.toBeInstanceOf(PersonDocumentAlreadyExists);
  });

  it("deletes a person", async () => {
    const person = Person.create({
      name: PersonName.create("Grace"),
      document: PersonDocument.create("16899535009"),
      phone: PersonPhone.create("+5511999997777"),
      email: PersonEmail.create("grace@example.com"),
      role: PersonRole.CUSTOMER,
    });

    const created = await repository.create(person);
    const id = created.toSnapshot().id!;

    await repository.delete(id);

    const found = await repository.findById(id);
    expect(found).toBeNull();

    const rows = await db.select().from(personTable);
    expect(rows.length).toBe(0);
  });
});
