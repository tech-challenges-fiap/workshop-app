import { afterEach, describe, expect, it } from "bun:test";

import { loadRuntimeConfig } from "./config";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("loadRuntimeConfig", () => {
  it("uses default values when env vars are not defined", () => {
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.BEECEPTOR_NOTIFICATION_URL;
    delete process.env.APP_PORT;
    delete process.env.JWT_SECRET;
    delete process.env.JWT_ISSUER;
    delete process.env.JWT_AUDIENCE;
    delete process.env.APP_ENV;

    const config = loadRuntimeConfig();

    expect(config).toEqual({
      adminUsername: "admin",
      adminPassword: "change-me",
      beeceptorNotificationUrl: "https://app.beeceptor.com/console/14soat-group61",
      appPort: 3000,
      jwtSecret: undefined,
      jwtIssuer: "workshop-edge",
      jwtAudience: "workshop-app",
      appEnv: "test",
    });
  });

  it("uses env var overrides when provided", () => {
    process.env.ADMIN_USERNAME = "custom-admin";
    process.env.ADMIN_PASSWORD = "custom-password";
    process.env.BEECEPTOR_NOTIFICATION_URL = "https://example.com/notify";
    process.env.APP_PORT = "4001";
    process.env.JWT_SECRET = "custom-secret";
    process.env.JWT_ISSUER = "custom-edge";
    process.env.JWT_AUDIENCE = "custom-app";
    process.env.APP_ENV = "stag";

    const config = loadRuntimeConfig();

    expect(config).toEqual({
      adminUsername: "custom-admin",
      adminPassword: "custom-password",
      beeceptorNotificationUrl: "https://example.com/notify",
      appPort: 4001,
      jwtSecret: "custom-secret",
      jwtIssuer: "custom-edge",
      jwtAudience: "custom-app",
      appEnv: "stag",
    });
  });

  it("falls back to port 3000 when APP_PORT is invalid", () => {
    process.env.APP_PORT = "invalid";

    const config = loadRuntimeConfig();

    expect(config.appPort).toBe(3000);
  });

  it("falls back to port 3000 when APP_PORT is zero", () => {
    process.env.APP_PORT = "0";

    const config = loadRuntimeConfig();

    expect(config.appPort).toBe(3000);
  });
});
