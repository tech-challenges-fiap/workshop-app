import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

import { person } from "./person";
import { workOrders } from "./work-order";

export const workOrderStatusHistory = pgTable("work_order_status_history", {
  id: serial("id").primaryKey(),
  workOrderId: integer("work_order_id")
    .notNull()
    .references(() => workOrders.id),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  changedByPersonId: integer("changed_by_person_id").references(() => person.id),
  reason: text("reason"),
});
