export interface NotificationInput {
  email: string;
  phone: string;
  message: string;
}

export interface Notification {
  send(input: NotificationInput): Promise<void>;
}
