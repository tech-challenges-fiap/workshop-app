// Read-model projection for Phase 4 (f4-os-service-boundary).
// This table is populated by seed or replication and must not be mutated
// through OS Service business logic. Vehicle master data flows into
// workshop-app as a projection only.
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
