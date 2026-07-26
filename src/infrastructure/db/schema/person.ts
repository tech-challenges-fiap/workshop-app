// Read-model projection for Phase 4 (f4-os-service-boundary).
// This table is populated by seed or replication and must not be mutated
// through OS Service business logic. Person master data is owned by a
// People/Identity service and flows into workshop-app as a projection only.
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
