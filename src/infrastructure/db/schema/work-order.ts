import { integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { vehicles } from "./vehicle";

export const workOrders = pgTable("work_orders", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id")
    .notNull()
    .references(() => vehicles.id),
  status: text("status").notNull(),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
  publicToken: text("public_token").notNull().unique(),
  publicTokenExpiresAt: timestamp("public_token_expires_at", {
    withTimezone: true,
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
