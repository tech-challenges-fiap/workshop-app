import { integer, numeric, pgTable, serial, text } from "drizzle-orm/pg-core";

export const stockItems = pgTable("stock_items", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  unitOfMeasure: text("unit_of_measure"),
  quantity: integer("quantity").notNull(),
  price: numeric("price", { precision: 15, scale: 2 }).notNull(),
});
