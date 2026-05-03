import { beforeAll, describe, expect, it, vi } from "bun:test";
import { Hono } from "hono";

import { registerVehicleRoutes } from "./vehicles";
import { CreateVehicle } from "../application/vehicle/create-vehicle";
import { GetVehicleById } from "../application/vehicle/get-vehicle-by-id";
import { ListVehicles } from "../application/vehicle/list-vehicles";
import { GetVehicleByPlate } from "../application/vehicle/get-vehicle-by-plate";
import { UpdateVehicle } from "../application/vehicle/update-vehicle";
import { DeleteVehicle } from "../application/vehicle/delete-vehicle";
import { Vehicle } from "../domain/vehicle/aggregate/vehicle";
import { VehicleBrand } from "../domain/vehicle/value-object/vehicle-brand";
import { VehiclePlate } from "../domain/vehicle/value-object/vehicle-plate";
import { VehicleModel } from "../domain/vehicle/value-object/vehicle-model";
import { VehicleYear } from "../domain/vehicle/value-object/vehicle-year";
import type { VehicleRepository } from "../domain/vehicle/repository/vehicle-repository";
import type { PersonRepository } from "../domain/person/repository/person-repository";
import type { Person } from "../domain/person/aggregate/person";
import type { PersonDocument } from "../domain/person/value-object/person-document";
import { adminAuthMiddleware } from "./middleware/auth";
import { signToken } from "../infrastructure/auth/jwt";

// Simple Mock Repository
class MockVehicleRepository implements VehicleRepository {
  public vehicles: Vehicle[] = [];
  private nextId = 1;
  async create(v: Vehicle) {
    // Simulate ID generation
    const snapshot = v.toSnapshot();
    const created = Vehicle.rehydrate({
      id: this.nextId++,
      plate: VehiclePlate.create(snapshot.plate),
      brand: VehicleBrand.create(snapshot.brand),
      model: VehicleModel.create(snapshot.model),
      year: VehicleYear.create(snapshot.year),
      ownerPersonId: snapshot.ownerPersonId,
    } as any); // Simple bypass for rehydrate typings matching
    this.vehicles.push(created);
    return created;
  }
  async findById(id: number) {
    return this.vehicles.find((v) => v.toSnapshot().id === id) || null;
  }
  async findByPlate(p: VehiclePlate) {
    return this.vehicles.find((v) => v.toSnapshot().plate === p.toString()) || null;
  }
  async findAll() {
    return this.vehicles;
  }
  async save(v: Vehicle) {
    const idx = this.vehicles.findIndex((x) => x.toSnapshot().id === v.toSnapshot().id);
    if (idx !== -1) this.vehicles[idx] = v;
  }
  async delete(id: number) {
    this.vehicles = this.vehicles.filter((v) => v.toSnapshot().id !== id);
  }
}

class MockPersonRepository implements PersonRepository {
  constructor(private readonly existingIds: number[] = [1, 2]) {}

  async create(person: Person): Promise<Person> {
    void person;
    throw new Error("Not implemented in mock");
  }

  async findById(id: number): Promise<Person | null> {
    if (!this.existingIds.includes(id)) {
      return null;
    }

    return {
      toSnapshot: () => ({
        id,
        name: "Person",
        document: "doc",
        phone: "phone",
        email: "email",
        role: "customer",
      }),
    } as unknown as Person;
  }

  async findByDocument(_document: PersonDocument): Promise<Person | null> {
    void _document;
    throw new Error("Not implemented in mock");
  }

  async findAll(): Promise<Person[]> {
    return [];
  }

  async save(_person: Person): Promise<void> {
    void _person;
    throw new Error("Not implemented in mock");
  }

  async delete(_id: number): Promise<void> {
    void _id;
    throw new Error("Not implemented in mock");
  }
}

describe("Vehicle Routes", () => {
  const repo = new MockVehicleRepository();
  const personRepo = new MockPersonRepository();
  const app = new Hono();
  registerVehicleRoutes(app, {
    createVehicle: new CreateVehicle(repo, personRepo),
    getVehicleById: new GetVehicleById(repo),
    listVehicles: new ListVehicles(repo),
    getVehicleByPlate: new GetVehicleByPlate(repo),
    updateVehicle: new UpdateVehicle(repo, personRepo),
    deleteVehicle: new DeleteVehicle(repo),
  });

  it("POST /vehicles - creates a vehicle", async () => {
    const res = await app.request("/vehicles", {
      method: "POST",
      body: JSON.stringify({
        plate: "ABC-1234",
        brand: "Honda",
        model: "Civic",
        year: 2022,
        ownerPersonId: 1,
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(body.plate).toBe("ABC-1234");
    expect(body.brand).toBe("Honda");
  });

  it("POST /vehicles - returns 400 when body is invalid", async () => {
    const res = await app.request("/vehicles", {
      method: "POST",
      body: JSON.stringify({
        plate: "", // inválido
        brand: "",
        model: "",
        year: 1800,
        ownerPersonId: 0,
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
  });

  it("POST /vehicles - returns 500 on unexpected error", async () => {
    const executeSpy = vi.spyOn(CreateVehicle.prototype, "execute");
    executeSpy.mockRejectedValueOnce(new Error("unexpected"));

    const res = await app.request("/vehicles", {
      method: "POST",
      body: JSON.stringify({
        plate: "ERR-POST",
        brand: "Brand",
        model: "Model",
        year: 2022,
        ownerPersonId: 1,
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(500);

    executeSpy.mockRestore();
  });

  it("POST /vehicles - returns 409 if plate exists", async () => {
    // Should fail because ABC-1234 was created in validation above?
    // Actually the repo state persists across tests in this describe block if not reset.
    // Let's rely on that or create a conflict explicitly.

    // Create first
    await app.request("/vehicles", {
      method: "POST",
      body: JSON.stringify({
        plate: "XYZ-9999",
        brand: "Honda",
        model: "Civic",
        year: 2022,
        ownerPersonId: 1,
      }),
      headers: { "Content-Type": "application/json" },
    });

    // Try again
    const res = await app.request("/vehicles", {
      method: "POST",
      body: JSON.stringify({
        plate: "XYZ-9999",
        brand: "Honda",
        model: "Civic",
        year: 2022,
        ownerPersonId: 1,
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(409);
  });

  it("POST /vehicles - returns 404 if owner person does not exist", async () => {
    const repo = new MockVehicleRepository();
    const personRepo = new MockPersonRepository([]);
    const app = new Hono();

    registerVehicleRoutes(app, {
      createVehicle: new CreateVehicle(repo, personRepo),
      getVehicleById: new GetVehicleById(repo),
      listVehicles: new ListVehicles(repo),
      getVehicleByPlate: new GetVehicleByPlate(repo),
      updateVehicle: new UpdateVehicle(repo, personRepo),
      deleteVehicle: new DeleteVehicle(repo),
    });

    const res = await app.request("/vehicles", {
      method: "POST",
      body: JSON.stringify({
        plate: "NOO1A23",
        brand: "Honda",
        model: "Civic",
        year: 2022,
        ownerPersonId: 999,
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("PersonNotFound");
  });

  it("GET /vehicles - lists vehicles", async () => {
    const res = await app.request("/vehicles");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it("GET /vehicles - returns 500 on unexpected error", async () => {
    const listSpy = vi.spyOn(ListVehicles.prototype, "execute");
    listSpy.mockRejectedValueOnce(new Error("unexpected"));

    const res = await app.request("/vehicles");
    expect(res.status).toBe(500);

    listSpy.mockRestore();
  });

  it("GET /vehicles/by-plate/:plate - returns vehicle when found", async () => {
    const plate = "BYT-1234";

    const createRes = await app.request("/vehicles", {
      method: "POST",
      body: JSON.stringify({
        plate,
        brand: "Brand",
        model: "Model",
        year: 2022,
        ownerPersonId: 1,
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(createRes.status).toBe(201);

    const res = await app.request(`/vehicles/by-plate/${plate}`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plate).toBe(plate);
  });

  it("GET /vehicles/by-plate/:plate - returns 404 when not found", async () => {
    const res = await app.request("/vehicles/by-plate/ZZZ-9999");

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("Vehicle not found");
  });

  it("GET /vehicles/by-plate/:plate - returns 400 when plate is invalid", async () => {
    const res = await app.request("/vehicles/by-plate/invalid-plate");

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
  });

  it("GET /vehicles/by-plate/:plate - returns 500 on unexpected error", async () => {
    const spy = vi.spyOn(GetVehicleByPlate.prototype, "execute");
    spy.mockRejectedValueOnce(new Error("unexpected"));

    const res = await app.request("/vehicles/by-plate/ABC-1234");

    expect(res.status).toBe(500);

    spy.mockRestore();
  });

  it("GET /vehicles/:id - returns 400 when id is invalid", async () => {
    const res = await app.request("/vehicles/not-a-number");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid ID format");
  });

  it("GET /vehicles/:id - returns vehicle", async () => {
    // Create one specifically to fetch
    const createRes = await app.request("/vehicles", {
      method: "POST",
      body: JSON.stringify({
        plate: "GET-1111",
        brand: "Honda",
        model: "Get Me",
        year: 2022,
        ownerPersonId: 1,
      }),
      headers: { "Content-Type": "application/json" },
    });
    const created = await createRes.json();
    const id = created.id;

    const res = await app.request(`/vehicles/${id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(id);
    expect(body.brand).toBe("Honda");
  });

  it("GET /vehicles/:id - returns 404 when vehicle not found", async () => {
    const randomId = 999999;

    const res = await app.request(`/vehicles/${randomId}`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("Vehicle not found");
  });

  it("GET /vehicles/:id - returns 500 on unexpected error", async () => {
    const randomId = 999999;

    const getVehicleSpy = vi.spyOn(GetVehicleById.prototype, "execute");
    getVehicleSpy.mockRejectedValueOnce(new Error("unexpected"));

    const res = await app.request(`/vehicles/${randomId}`);
    expect(res.status).toBe(500);

    getVehicleSpy.mockRestore();
  });

  it("DELETE /vehicles/:id - removes vehicle", async () => {
    // Create one specifically to delete
    const createRes = await app.request("/vehicles", {
      method: "POST",
      body: JSON.stringify({
        plate: "DEL-1111",
        brand: "Honda",
        model: "Delete Me",
        year: 2022,
        ownerPersonId: 1,
      }),
      headers: { "Content-Type": "application/json" },
    });
    const created = await createRes.json();
    const id = created.id;

    const res = await app.request(`/vehicles/${id}`, { method: "DELETE" });
    expect(res.status).toBe(204);

    // Verify it's gone
    const verify = await app.request(`/vehicles/${id}`);
    expect(verify.status).toBe(404);
  });

  it("DELETE /vehicles/:id - returns 400 when id is invalid", async () => {
    const res = await app.request("/vehicles/not-a-number", {
      method: "DELETE",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid ID format");
  });

  it("DELETE /vehicles/:id - returns 404 when vehicle not found", async () => {
    const randomId = 999999;
    const res = await app.request(`/vehicles/${randomId}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("Vehicle not found");
  });

  it("DELETE /vehicles/:id - returns 500 on unexpected error", async () => {
    const randomId = 999999;

    const deleteVehicleSpy = vi.spyOn(DeleteVehicle.prototype, "execute");
    deleteVehicleSpy.mockRejectedValueOnce(new Error("unexpected"));

    const res = await app.request(`/vehicles/${randomId}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(500);

    deleteVehicleSpy.mockRestore();
  });

  it("PUT /vehicles/:id - returns 400 when body is invalid", async () => {
    // cria veículo válido
    const createRes = await app.request("/vehicles", {
      method: "POST",
      body: JSON.stringify({
        plate: "PUT-1111",
        brand: "Honda",
        model: "Model",
        year: 2022,
        ownerPersonId: 1,
      }),
      headers: { "Content-Type": "application/json" },
    });
    const created = await createRes.json();

    const res = await app.request(`/vehicles/${created.id}`, {
      method: "PUT",
      body: JSON.stringify({ year: 1800 }), // inválido pelo schema
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
  });

  it("PUT /vehicles/:id - returns 404 when vehicle not found", async () => {
    const randomId = 999999;

    const res = await app.request(`/vehicles/${randomId}`, {
      method: "PUT",
      body: JSON.stringify({ model: "New Model" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(404);
  });

  it("PUT /vehicles/:id - returns 409 when plate already exists", async () => {
    // cria dois veículos
    const first = await app.request("/vehicles", {
      method: "POST",
      body: JSON.stringify({
        plate: "PLT-1111",
        brand: "Brand1",
        model: "Model1",
        year: 2022,
        ownerPersonId: 1,
      }),
      headers: { "Content-Type": "application/json" },
    });
    const firstBody = await first.json();

    const second = await app.request("/vehicles", {
      method: "POST",
      body: JSON.stringify({
        plate: "PLT-2222",
        brand: "Brand2",
        model: "Model2",
        year: 2022,
        ownerPersonId: 2,
      }),
      headers: { "Content-Type": "application/json" },
    });
    const secondBody = await second.json();

    const res = await app.request(`/vehicles/${secondBody.id}`, {
      method: "PUT",
      body: JSON.stringify({ plate: firstBody.plate }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(409);
  });

  it("PUT /vehicles/:id - returns 500 on unexpected error", async () => {
    const createRes = await app.request("/vehicles", {
      method: "POST",
      body: JSON.stringify({
        plate: "ERR-5000",
        brand: "Brand",
        model: "Err Model",
        year: 2022,
        ownerPersonId: 1,
      }),
      headers: { "Content-Type": "application/json" },
    });
    const created = await createRes.json();

    const updateSpy = vi.spyOn(UpdateVehicle.prototype, "execute");
    updateSpy.mockRejectedValueOnce(new Error("unexpected"));

    const res = await app.request(`/vehicles/${created.id}`, {
      method: "PUT",
      body: JSON.stringify({ model: "Any" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(500);

    updateSpy.mockRestore();
  });

  describe("authentication", () => {
    beforeAll(() => {
      process.env.JWT_SECRET = "test-secret";
    });

    function createAppWithAuth() {
      const repo = new MockVehicleRepository();
      const personRepo = new MockPersonRepository();
      const app = new Hono();

      app.use("/vehicles/*", adminAuthMiddleware);

      registerVehicleRoutes(app, {
        createVehicle: new CreateVehicle(repo, personRepo),
        getVehicleById: new GetVehicleById(repo),
        listVehicles: new ListVehicles(repo),
        getVehicleByPlate: new GetVehicleByPlate(repo),
        updateVehicle: new UpdateVehicle(repo, personRepo),
        deleteVehicle: new DeleteVehicle(repo),
      });

      return app;
    }

    it("returns 401 when Authorization header is missing", async () => {
      const app = createAppWithAuth();

      const res = await app.request("/vehicles", {
        method: "POST",
        body: JSON.stringify({
          plate: "ABC-1234",
          brand: "Brand",
          model: "Model",
          year: 2022,
          ownerPersonId: 1,
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(401);
    });

    it("returns 401 when token is invalid", async () => {
      const app = createAppWithAuth();

      const res = await app.request("/vehicles", {
        method: "POST",
        body: JSON.stringify({
          plate: "ABC-2345",
          brand: "Brand",
          model: "Model",
          year: 2022,
          ownerPersonId: 1,
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer invalid-token",
        },
      });

      expect(res.status).toBe(401);
    });

    it("allows access with a valid token", async () => {
      const app = createAppWithAuth();

      const token = signToken({ sub: "admin" });

      const res = await app.request("/vehicles", {
        method: "POST",
        body: JSON.stringify({
          plate: "ABC-3456",
          brand: "Brand",
          model: "Model",
          year: 2022,
          ownerPersonId: 1,
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(201);
    });
  });
});
