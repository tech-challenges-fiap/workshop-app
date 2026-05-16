import { describe, expect, it } from "bun:test";
import { Hono } from "hono";

import { registerOpenApiRoutes } from "./openapi";

function createApp() {
  const app = new Hono();
  registerOpenApiRoutes(app);
  return app;
}

describe("GET /docs", () => {
  it("returns 200 with Swagger UI HTML", async () => {
    const app = createApp();

    const response = await app.request("/docs");

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("swagger-ui");
    expect(html).toContain("SwaggerUIBundle");
  });

  it("references openapi.yaml as a relative URL so it resolves correctly regardless of path prefix", async () => {
    const app = createApp();

    const response = await app.request("/docs");

    expect(response.status).toBe(200);
    const html = await response.text();

    // Must be a relative URL — an absolute or root-relative URL breaks under a
    // path-prefixed deployment (e.g. /stag/api/docs) because the browser would
    // strip the prefix when resolving it.
    expect(html).toContain("url: './openapi.yaml'");
    expect(html).not.toMatch(/url: 'https?:\/\//);
    expect(html).not.toContain("url: '/openapi.yaml'");
  });
});
