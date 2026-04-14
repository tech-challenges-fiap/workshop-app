import { describe, expect, test } from "bun:test";

import { buildHealthPayload, handleRequest } from "../src/app.ts";

describe("buildHealthPayload", () => {
  test("returns the bootstrap payload", () => {
    const payload = buildHealthPayload(new Date("2026-01-01T00:00:00.000Z"));

    expect(payload).toEqual({
      service: "workshop-app",
      status: "ok",
      timestamp: "2026-01-01T00:00:00.000Z",
    });
  });
});

describe("handleRequest", () => {
  test("returns a health response", async () => {
    const response = handleRequest(new Request("http://localhost/health"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      service: "workshop-app",
      status: "ok",
    });
  });

  test("returns not found for unknown routes", async () => {
    const response = handleRequest(new Request("http://localhost/unknown"));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });
});

