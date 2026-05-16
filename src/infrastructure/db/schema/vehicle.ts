import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { person } from "./person";

export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  plate: text("plate").notNull().unique(),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  year: integer("year").notNull(),
  ownerPersonId: integer("owner_person_id")
    .notNull()
    .references(() => person.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
