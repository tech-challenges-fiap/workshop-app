import type { Notification, NotificationInput } from "../../application/notification/notification";

export class NoopNotification implements Notification {
  public async send(input: NotificationInput): Promise<void> {
    void input;
    // Intentionally no-op: allows environments without outbound webhook config.
  }
}
