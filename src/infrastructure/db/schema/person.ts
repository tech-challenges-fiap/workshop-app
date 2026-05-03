import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const person = pgTable("person", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  document: text("document").notNull().unique(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull().default("active"),
});
