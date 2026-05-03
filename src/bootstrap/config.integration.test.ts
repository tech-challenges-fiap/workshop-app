import { afterAll, beforeAll, describe, expect, it } from "bun:test";

const ORIGINAL_ENV = { ...process.env };

let app: Awaited<ReturnType<typeof importMainModule>>["app"];
let startupConfig: Awaited<ReturnType<typeof importMainModule>>["startupConfig"];

async function importMainModule() {
  return import("../main");
}

beforeAll(async () => {
  process.env = { ...ORIGINAL_ENV };
  process.env.NODE_ENV = "test";
  process.env.ADMIN_USERNAME = "env-admin";
  process.env.ADMIN_PASSWORD = "env-password";
  process.env.BEECEPTOR_NOTIFICATION_URL = "https://example.com/hook";
  process.env.JWT_SECRET = "test-secret";

  const mainModule = await importMainModule();
  app = mainModule.app;
  startupConfig = mainModule.startupConfig;
});

afterAll(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("main runtime config wiring", () => {
  it("does not expose /auth/login from the composed app", async () => {
    const response = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "env-admin",
        password: "env-password",
      }),
    });

    expect(response.status).toBe(404);
  });

  it("loads notification URL override from env in composition startup config", () => {
    expect(startupConfig.beeceptorNotificationUrl).toBe("https://example.com/hook");
  });

  it("loads overridden admin credentials in composition startup config", () => {
    expect(startupConfig.adminUsername).toBe("env-admin");
    expect(startupConfig.adminPassword).toBe("env-password");
    expect(startupConfig.jwtIssuer).toBe("workshop-edge");
    expect(startupConfig.jwtAudience).toBe("workshop-app");
  });
});
