import { beforeAll, describe, expect, it, vi } from "bun:test";
import { Hono } from "hono";

import { registerPersonRoutes } from "./person";
import { CreatePerson } from "../application/person/create-person";
import { GetPersonById } from "../application/person/get-person-by-id";
import { ListPersons } from "../application/person/list-persons";
import { UpdatePerson } from "../application/person/update-person";
import { DeletePerson } from "../application/person/delete-person";
import type { PersonRepository } from "../domain/person/repository/person-repository";
import { Person } from "../domain/person/aggregate/person";
import { PersonName } from "../domain/person/value-object/person-name";
import { PersonDocument } from "../domain/person/value-object/person-document";
import { PersonPhone } from "../domain/person/value-object/person-phone";
import { PersonEmail } from "../domain/person/value-object/person-email";
import { PersonRole } from "../domain/person/value-object/person-role";
import { adminAuthMiddleware } from "./middleware/auth";
import { signToken } from "../infrastructure/auth/jwt";

class InMemoryPersonRepository implements PersonRepository {
  public persons: Person[] = [];
  private nextId = 1;

  public async create(person: Person): Promise<Person> {
    const snapshot = person.toSnapshot();
    const created = Person.rehydrate({
      id: this.nextId++,
      name: PersonName.create(snapshot.name),
      document: PersonDocument.create(snapshot.document),
      phone: PersonPhone.create(snapshot.phone),
      email: PersonEmail.create(snapshot.email),
      role: snapshot.role as PersonRole,
    });
    this.persons.push(created);
    return created;
  }

  public async findById(id: number): Promise<Person | null> {
    return this.persons.find((p) => p.toSnapshot().id === id) ?? null;
  }

  public async findByDocument(document: PersonDocument): Promise<Person | null> {
    return this.persons.find((p) => p.toSnapshot().document === document.toString()) ?? null;
  }

  public async findAll(): Promise<Person[]> {
    return this.persons;
  }

  public async save(person: Person): Promise<void> {
    const snapshot = person.toSnapshot();
    const index = this.persons.findIndex((p) => p.toSnapshot().id === snapshot.id);
    if (index !== -1) {
      this.persons[index] = person;
    }
  }

  public async delete(id: number): Promise<void> {
    this.persons = this.persons.filter((p) => p.toSnapshot().id !== id);
  }
}

function createApp() {
  const repo = new InMemoryPersonRepository();
  const app = new Hono();

  registerPersonRoutes(app, {
    createPerson: new CreatePerson(repo),
    getPersonById: new GetPersonById(repo),
    listPersons: new ListPersons(repo),
    updatePerson: new UpdatePerson(repo),
    deletePerson: new DeletePerson(repo),
  });

  return { app, repo };
}

function createAppWithAuth() {
  const repo = new InMemoryPersonRepository();
  const app = new Hono();

  app.use("/person/*", adminAuthMiddleware);

  registerPersonRoutes(app, {
    createPerson: new CreatePerson(repo),
    getPersonById: new GetPersonById(repo),
    listPersons: new ListPersons(repo),
    updatePerson: new UpdatePerson(repo),
    deletePerson: new DeletePerson(repo),
  });

  return { app, repo };
}

describe("Person routes", () => {
  it("creates a person and returns 201", async () => {
    const { app } = createApp();

    const response = await app.request("/person", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "John Doe",
        document: "52998224725",
        phone: "+5511999999999",
        email: "john@example.com",
        role: "customer",
      }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();

    expect(typeof body.id).toBe("number");
    expect(body).toMatchObject({
      name: "John Doe",
      document: "52998224725",
      phone: "+5511999999999",
      email: "john@example.com",
      role: "customer",
    });
  });

  it("returns 400 when create payload has invalid CPF check digits", async () => {
    const { app } = createApp();

    const response = await app.request("/person", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "John Doe",
        document: "52998224724",
        phone: "+5511999999999",
        email: "john@example.com",
        role: "customer",
      }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("ValidationError");
    expect(body.details[0].message).toBe("Person document must have valid check digits");
  });

  it("accepts formatted CPF and normalizes it in response", async () => {
    const { app } = createApp();

    const response = await app.request("/person", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "John Doe",
        document: "529.982.247-25",
        phone: "+5511999999999",
        email: "john@example.com",
        role: "customer",
      }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.document).toBe("52998224725");
  });

  it("returns 409 when document already exists", async () => {
    const { app, repo } = createApp();

    const existing = Person.create({
      name: PersonName.create("Existing"),
      document: PersonDocument.create("52998224725"),
      phone: PersonPhone.create("+5511999999999"),
      email: PersonEmail.create("existing@example.com"),
      role: PersonRole.CUSTOMER,
    });

    await repo.create(existing);

    const response = await app.request("/person", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "John Doe",
        document: "52998224725",
        phone: "+5511999999999",
        email: "john@example.com",
        role: "customer",
      }),
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    // eslint-disable-next-line no-secrets/no-secrets
    expect(body.error).toBe("PersonDocumentAlreadyExists");
  });

  it("returns 400 when create body is invalid", async () => {
    const { app } = createApp();

    const response = await app.request("/person", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "", // invalid
        document: "",
        phone: "",
        email: "not-an-email",
        role: "invalid-role",
      }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("ValidationError");
    expect(Array.isArray(body.details)).toBe(true);
  });

  it("lists persons and returns 200", async () => {
    const { app } = createApp();

    const createResponse = await app.request("/person", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "John Doe",
        document: "52998224725",
        phone: "+5511999999999",
        email: "john@example.com",
        role: "customer",
      }),
    });

    expect(createResponse.status).toBe(201);

    const listResponse = await app.request("/person", {
      method: "GET",
    });

    expect(listResponse.status).toBe(200);
    const body = await listResponse.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body[0].name).toBe("John Doe");
  });

  it("gets a person by id and returns 200", async () => {
    const { app } = createApp();

    const createResponse = await app.request("/person", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "John Doe",
        document: "52998224725",
        phone: "+5511999999999",
        email: "john@example.com",
        role: "customer",
      }),
    });

    const created = await createResponse.json();

    const response = await app.request(`/person/${created.id}`, {
      method: "GET",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe(created.id);
  });

  it("returns 404 when person is not found", async () => {
    const { app } = createApp();

    const response = await app.request("/person/9999", {
      method: "GET",
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("PersonNotFound");
  });

  it("updates a person and returns 200", async () => {
    const { app } = createApp();

    const createResponse = await app.request("/person", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "John Doe",
        document: "52998224725",
        phone: "+5511999999999",
        email: "john@example.com",
        role: "customer",
      }),
    });

    const created = await createResponse.json();

    const response = await app.request(`/person/${created.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Jane Doe",
        role: "mecanic",
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.name).toBe("Jane Doe");
    expect(body.role).toBe("mecanic");
  });

  it("returns 404 when updating non-existing person", async () => {
    const { app } = createApp();

    const response = await app.request("/person/9999", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Jane Doe",
      }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("PersonNotFound");
  });

  it("returns 409 when updating to an existing document", async () => {
    const { app, repo } = createApp();

    const person1 = await repo.create(
      Person.create({
        name: PersonName.create("Person 1"),
        document: PersonDocument.create("52998224725"),
        phone: PersonPhone.create("+5511999999999"),
        email: PersonEmail.create("p1@example.com"),
        role: PersonRole.CUSTOMER,
      }),
    );

    await repo.create(
      Person.create({
        name: PersonName.create("Person 2"),
        document: PersonDocument.create("16899535009"),
        phone: PersonPhone.create("+5511999999988"),
        email: PersonEmail.create("p2@example.com"),
        role: PersonRole.CUSTOMER,
      }),
    );

    const response = await app.request(`/person/${person1.toSnapshot().id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        document: "16899535009",
      }),
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    // eslint-disable-next-line no-secrets/no-secrets
    expect(body.error).toBe("PersonDocumentAlreadyExists");
  });

  it("deletes a person and returns 204", async () => {
    const { app } = createApp();

    const createResponse = await app.request("/person", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "John Doe",
        document: "52998224725",
        phone: "+5511999999999",
        email: "john@example.com",
        role: "customer",
      }),
    });

    const created = await createResponse.json();

    const response = await app.request(`/person/${created.id}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(204);
  });

  it("returns 404 when deleting non-existing person", async () => {
    const { app } = createApp();

    const response = await app.request("/person/9999", {
      method: "DELETE",
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("PersonNotFound");
  });

  it("returns 500 when an unexpected Error is thrown on GET /person/:id", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const app = new Hono();

    registerPersonRoutes(app, {
      createPerson: {} as unknown as CreatePerson,
      getPersonById: {
        async execute() {
          throw new Error("boom");
        },
      } as unknown as GetPersonById,
      listPersons: {} as unknown as ListPersons,
      updatePerson: {} as unknown as UpdatePerson,
      deletePerson: {} as unknown as DeletePerson,
    });

    const response = await app.request("/person/123", {
      method: "GET",
    });

    expect(response.status).toBe(500);
    const body = await response.json();

    expect(body).toMatchObject({
      error: "UnexpectedError",
      message: "boom",
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("returns 500 when an unknown non-Error is thrown on GET /person/:id", async () => {
    const app = new Hono();

    registerPersonRoutes(app, {
      createPerson: {} as unknown as CreatePerson,
      getPersonById: {
        async execute() {
          throw { reason: "unknown" };
        },
      } as unknown as GetPersonById,
      listPersons: {} as unknown as ListPersons,
      updatePerson: {} as unknown as UpdatePerson,
      deletePerson: {} as unknown as DeletePerson,
    });

    const response = await app.request("/person/123", {
      method: "GET",
    });

    expect(response.status).toBe(500);
    const body = await response.json();

    expect(body).toMatchObject({
      error: "UnknownError",
    });
  });
});

describe("Person routes with auth", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  it("returns 401 when no token is provided", async () => {
    const { app } = createAppWithAuth();

    const response = await app.request("/person", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "John Doe",
        document: "52998224725",
        phone: "+5511999999999",
        email: "john@example.com",
        role: "customer",
      }),
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("creates a person when a valid token is provided", async () => {
    const { app } = createAppWithAuth();

    const token = signToken({ sub: "admin" });

    const response = await app.request("/person", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: "John Doe",
        document: "52998224725",
        phone: "+5511999999999",
        email: "john@example.com",
        role: "customer",
      }),
    });

    expect(response.status).toBe(201);
  });
});
