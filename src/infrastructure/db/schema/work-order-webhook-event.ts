import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const workOrderWebhookEvents = pgTable("work_order_webhook_events", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  payloadHash: text("payload_hash").notNull(),
  status: text("status").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
