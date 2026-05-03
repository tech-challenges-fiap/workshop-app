import { describe, expect, it } from "bun:test";

import { createApp } from "./create-app";

describe("createApp", () => {
  it("returns an app where /health responds with 200 and status ok payload", async () => {
    const app = createApp();
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
    });
  });
});
