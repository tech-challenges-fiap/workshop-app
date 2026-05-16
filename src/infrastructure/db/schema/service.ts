import { integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { stockItems } from "./stock-item";

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  estimatedTimeMinutes: integer("estimated_time_minutes").notNull(),
  price: numeric("price", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const serviceRequiredStockItems = pgTable("service_stock_items", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id")
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),
  stockItemId: integer("stock_item_id")
    .notNull()
    .references(() => stockItems.id),
  quantity: integer("quantity").notNull(),
});
