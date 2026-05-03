import { integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { services } from "./service";
import { workOrders } from "./work-order";

export const serviceTasks = pgTable("service_tasks", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id")
    .notNull()
    .references(() => services.id),
  workOrderId: integer("work_order_id")
    .notNull()
    .references(() => workOrders.id, {
      onDelete: "cascade",
    }),
  status: text("status").notNull(),
  estimatedTimeMinutes: integer("estimated_time_minutes").notNull(),
  servicePrice: numeric("service_price", { precision: 15, scale: 2 }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
