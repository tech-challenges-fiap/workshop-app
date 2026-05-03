import { describe, expect, it } from "bun:test";
import { Hono } from "hono";

import { registerAuthRoutes } from "./auth";
import { LoginAdmin } from "../application/auth/login-admin";

function createApp() {
  const app = new Hono();
  const loginAdmin = new LoginAdmin("admin", "secret");

  registerAuthRoutes(app, { loginAdmin });

  return app;
}

describe("POST /auth/login", () => {
  it("returns 410 because token issuance is delegated to workshop-edge", async () => {
    const app = createApp();

    const response = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "admin",
        password: "secret",
      }),
    });

    expect(response.status).toBe(410);

    const body = await response.json();

    expect(body).toMatchObject({
      error: "AuthDelegated",
    });
  });
});
