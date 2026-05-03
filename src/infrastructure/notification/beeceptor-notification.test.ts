import { describe, expect, it, vi } from "bun:test";

import { BeeceptorNotification } from "./beeceptor-notification";

describe("BeeceptorNotification", () => {
  it("sends email and phone only in the request body", async () => {
    const fetchSpy = vi.fn(
      async (
        url: string,
        init: {
          method: string;
          headers?: Record<string, string>;
          body?: string;
        },
      ) => {
        // basic usage to keep TypeScript/ESLint happy and document expectations
        expect(typeof url).toBe("string");
        expect(init.method).toBe("POST");

        return {
          ok: true,
          status: 200,
        };
      },
    );

    const notification = new BeeceptorNotification("https://example.com/notify", fetchSpy);

    await notification.send({
      email: "user@example.com",
      phone: "+5511999999999",
      message: "Test notification",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0] as [
      string,
      {
        method: string;
        headers?: Record<string, string>;
        body?: string;
      },
    ];

    expect(url).toBe("https://example.com/notify");
    expect(init.method).toBe("POST");
    expect(init.headers?.["Content-Type"]).toBe("application/json");

    expect(typeof init.body).toBe("string");

    const parsedBody = JSON.parse(init.body ?? "{}");

    expect(parsedBody).toMatchObject({
      email: "user@example.com",
      phone: "+5511999999999",
      message: "Test notification",
    });
  });

  it("throws when Beeceptor responds with a non-2xx status", async () => {
    const fetchSpy = vi.fn(async () => {
      return {
        ok: false,
        status: 500,
      };
    });

    const notification = new BeeceptorNotification("https://example.com/notify", fetchSpy);

    expect(
      notification.send({
        email: "user@example.com",
        phone: "+5511999999999",
        message: "Test notification",
      }),
    ).rejects.toThrowError(/Failed to send notification via Beeceptor/);
  });

  it("throws when endpoint URL is empty", () => {
    expect(
      () =>
        new BeeceptorNotification("", async () => ({
          ok: true,
          status: 200,
        })),
    ).toThrowError("Beeceptor notification endpoint URL must not be empty");
  });
});
