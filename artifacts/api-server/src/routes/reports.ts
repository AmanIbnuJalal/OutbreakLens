import { Router, type IRouter, type Request } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, reportsTable, usersTable } from "@workspace/db";
import {
  CreateReportBody,
  CreateReportResponse,
  ListMyReportsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function reportResponse(row: {
  reports: typeof reportsTable.$inferSelect;
  users: typeof usersTable.$inferSelect;
}) {
  return {
    id: row.reports.id,
    submittedBy: row.reports.submittedBy,
    sourceName: row.users.sourceName,
    sourceType: row.reports.sourceType,
    locationName: row.reports.locationName,
    lat: row.reports.lat,
    lng: row.reports.lng,
    symptom: row.reports.symptom,
    patientCount: row.reports.patientCount,
    medicineName: row.reports.medicineName,
    unitsSold: row.reports.unitsSold,
    reportDate: new Date(`${row.reports.reportDate}T00:00:00Z`),
    createdAt: row.reports.createdAt,
  };
}

router.post(
  "/reports",
  requireAuth,
  async (req: Request, res): Promise<void> => {
    const user = (req as Request & { user: typeof usersTable.$inferSelect }).user;
    if (user.role !== "source") {
      res.status(403).json({ error: "Source role required" });
      return;
    }

    const parsed = CreateReportBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [report] = await db
      .insert(reportsTable)
      .values({
        submittedBy: user.id,
        sourceType: user.sourceType,
        locationName: user.locationName,
        lat: user.lat,
        lng: user.lng,
        symptom: parsed.data.symptom,
        patientCount: parsed.data.patientCount,
        medicineName: parsed.data.medicineName ?? null,
        unitsSold: parsed.data.unitsSold ?? null,
        reportDate: formatDate(parsed.data.reportDate),
      })
      .returning();

    res.status(201).json(
      CreateReportResponse.parse({
        ...report,
        sourceName: user.sourceName,
        reportDate: new Date(`${report.reportDate}T00:00:00Z`),
      }),
    );
  },
);

router.get(
  "/reports/mine",
  requireAuth,
  async (req: Request, res): Promise<void> => {
    const user = (req as Request & { user: typeof usersTable.$inferSelect }).user;
    const rows = await db
      .select()
      .from(reportsTable)
      .innerJoin(usersTable, eq(reportsTable.submittedBy, usersTable.id))
      .where(and(eq(reportsTable.submittedBy, user.id)))
      .orderBy(desc(reportsTable.reportDate), desc(reportsTable.createdAt));
    res.json(ListMyReportsResponse.parse(rows.map(reportResponse)));
  },
);

export default router;