import { integer, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { workOrders } from "./work-order";

export const workOrderSagas = pgTable("work_order_sagas", {
  id: serial("id").primaryKey(),
  sagaId: uuid("saga_id").notNull().unique(),
  workOrderId: integer("work_order_id")
    .notNull()
    .unique()
    .references(() => workOrders.id),
  state: text("state").notNull(),
  lastEventId: text("last_event_id"),
  compensationReason: text("compensation_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workOrderSagaEvents = pgTable("work_order_saga_events", {
  id: serial("id").primaryKey(),
  sagaId: uuid("saga_id")
    .notNull()
    .references(() => workOrderSagas.sagaId),
  eventId: text("event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  payloadHash: text("payload_hash").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
