import { afterEach, describe, expect, it, vi } from "bun:test";
import { Hono } from "hono";

import { bootstrapServer } from "./bootstrap-server";
import type { AppRuntimeConfig } from "./config";
import * as dbModule from "../infrastructure/db";
import * as nodeServerModule from "@hono/node-server";

const BASE_CONFIG: AppRuntimeConfig = {
  adminUsername: "admin",
  adminPassword: "change-me",
  beeceptorNotificationUrl: "https://example.com/notify",
  appPort: 3000,
  jwtSecret: "secret",
  jwtIssuer: "workshop-edge",
  jwtAudience: "workshop-app",
  appEnv: "test",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("bootstrapServer", () => {
  it("exits when JWT_SECRET is missing", async () => {
    const app = new Hono();
    const ensureDbSpy = vi.spyOn(dbModule, "ensureDatabaseConnection");
    const serveSpy = vi.spyOn(nodeServerModule, "serve");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });

    expect(
      bootstrapServer(app, {
        ...BASE_CONFIG,
        jwtSecret: undefined,
      }),
    ).rejects.toThrow("process.exit:1");

    expect(JSON.parse(errorSpy.mock.calls[0]?.[0] as string)).toMatchObject({
      service: "workshop-app",
      level: "error",
      message: "Missing JWT_SECRET environment variable. Set it before starting the application.",
    });
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(ensureDbSpy).not.toHaveBeenCalled();
    expect(serveSpy).not.toHaveBeenCalled();
  });

  it("exits when JWT_SECRET is an empty string", async () => {
    const app = new Hono();
    const ensureDbSpy = vi.spyOn(dbModule, "ensureDatabaseConnection");
    const serveSpy = vi.spyOn(nodeServerModule, "serve");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });

    expect(
      bootstrapServer(app, {
        ...BASE_CONFIG,
        jwtSecret: "",
      }),
    ).rejects.toThrow("process.exit:1");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(ensureDbSpy).not.toHaveBeenCalled();
    expect(serveSpy).not.toHaveBeenCalled();
  });

  it("checks database connectivity and starts server when JWT_SECRET is present", async () => {
    const app = new Hono();
    const ensureDbSpy = vi.spyOn(dbModule, "ensureDatabaseConnection").mockResolvedValue(undefined);
    const serveSpy = vi.spyOn(nodeServerModule, "serve").mockImplementation(() => {
      return {
        address: () => null,
        close: () => null,
      } as never;
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });

    await bootstrapServer(app, {
      ...BASE_CONFIG,
      appPort: 4010,
      jwtSecret: "valid-secret",
    });

    expect(ensureDbSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(logSpy.mock.calls[0]?.[0] as string)).toMatchObject({
      service: "workshop-app",
      level: "info",
      message: "Starting HTTP server",
      port: 4010,
    });
    expect(serveSpy).toHaveBeenCalledWith({
      fetch: app.fetch,
      port: 4010,
    });
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
