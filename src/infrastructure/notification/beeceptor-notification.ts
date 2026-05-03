import type { Notification, NotificationInput } from "../../application/notification/notification";

interface HttpClient {
  (
    url: string,
    init: {
      method: string;
      headers?: Record<string, string>;
      body?: string;
    },
  ): Promise<{
    ok: boolean;
    status: number;
  }>;
}

export class BeeceptorNotification implements Notification {
  private readonly endpointUrl: string;
  private readonly httpClient: HttpClient;

  public constructor(endpointUrl: string, httpClient?: HttpClient) {
    if (!endpointUrl || endpointUrl.trim().length === 0) {
      throw new Error("Beeceptor notification endpoint URL must not be empty");
    }

    this.endpointUrl = endpointUrl;
    this.httpClient = httpClient ?? (async (url, init) => fetch(url, init));
  }

  public async send(input: NotificationInput): Promise<void> {
    const payload = {
      email: input.email,
      phone: input.phone,
      message: input.message,
    };

    const response = await this.httpClient(this.endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to send notification via Beeceptor: HTTP ${response.status}`);
    }
  }
}
