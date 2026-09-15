import { date, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const outbreakAlertsTable = pgTable("outbreak_alerts", {
  id: serial("id").primaryKey(),
  locationName: text("location_name").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  symptom: text("symptom").notNull(),
  zScore: real("z_score").notNull(),
  alertDate: date("alert_date", { mode: "string" }).notNull(),
  severity: text("severity").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOutbreakAlertSchema = createInsertSchema(outbreakAlertsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertOutbreakAlert = z.infer<typeof insertOutbreakAlertSchema>;
export type OutbreakAlert = typeof outbreakAlertsTable.$inferSelect;