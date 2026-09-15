import { date, integer, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const reportsTable = pgTable("reports", {
  id: serial("id").primaryKey(),
  submittedBy: integer("submitted_by").notNull().references(() => usersTable.id),
  sourceType: text("source_type").notNull(),
  locationName: text("location_name").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  symptom: text("symptom").notNull(),
  patientCount: integer("patient_count").notNull(),
  medicineName: text("medicine_name"),
  unitsSold: integer("units_sold"),
  reportDate: date("report_date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReportSchema = createInsertSchema(reportsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reportsTable.$inferSelect;