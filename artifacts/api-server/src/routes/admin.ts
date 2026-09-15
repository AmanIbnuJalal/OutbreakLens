import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, gte } from "drizzle-orm";
import { db, outbreakAlertsTable, reportsTable, usersTable } from "@workspace/db";
import {
  GetAdminOverviewResponse,
  GetHeatmapDataResponse,
  GetTrendQueryParams,
  GetTrendResponse,
  ListAdminReportsResponse,
  ListAdminReportsQueryParams,
  ListAlertsResponse,
  ListSourcesResponse,
  RunDetectionResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

type ReportRow = typeof reportsTable.$inferSelect;
type UserRow = typeof usersTable.$inferSelect;

function toReportResponse(report: ReportRow, user: UserRow) {
  return {
    id: report.id,
    submittedBy: report.submittedBy,
    sourceName: user.sourceName,
    sourceType: report.sourceType,
    locationName: report.locationName,
    lat: report.lat,
    lng: report.lng,
    symptom: report.symptom,
    patientCount: report.patientCount,
    medicineName: report.medicineName,
    unitsSold: report.unitsSold,
    reportDate: new Date(`${report.reportDate}T00:00:00Z`),
    createdAt: report.createdAt,
  };
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function daysBefore(date: string, count: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - count);
  return dateKey(value);
}

function buildTrend(reports: ReportRow[], location: string, symptom: string) {
  const counts = new Map<string, number>();
  for (const report of reports) {
    if (report.locationName !== location || report.symptom !== symptom) continue;
    counts.set(
      report.reportDate,
      (counts.get(report.reportDate) ?? 0) + report.patientCount,
    );
  }

  const dates = [...counts.keys()].sort();
  return dates.map((date, index) => {
    const baseline = Array.from({ length: 14 }, (_, offset) =>
      counts.get(daysBefore(date, offset + 1)) ?? 0,
    );
    const mean = baseline.reduce((sum, value) => sum + value, 0) / baseline.length;
    const variance =
      baseline.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      baseline.length;
    const standardDeviation = Math.sqrt(variance);
    const current = counts.get(date) ?? 0;
    const zScore =
      standardDeviation > 0
        ? (current - mean) / standardDeviation
        : current > mean && current > 0
          ? 4
          : 0;
    return {
      date: new Date(`${date}T00:00:00Z`),
      count: current,
      isAnomaly: index >= 7 && zScore >= 2.5,
      zScore: Number(zScore.toFixed(2)),
    };
  });
}

router.get(
  "/admin/overview",
  requireAdmin,
  async (_req, res): Promise<void> => {
    const [reports, alerts, sources] = await Promise.all([
      db.select().from(reportsTable),
      db.select().from(outbreakAlertsTable),
      db.select().from(usersTable).where(eq(usersTable.role, "source")),
    ]);
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 7);
    const locations = new Set(reports.map((report) => report.locationName));
    const latestAlert = [...alerts].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )[0];

    res.json(
      GetAdminOverviewResponse.parse({
        totalReports: reports.length,
        reportsLast7Days: reports.filter(
          (report) => new Date(`${report.reportDate}T00:00:00Z`) >= cutoff,
        ).length,
        activeAlerts: alerts.length,
        registeredSources: sources.length,
        locationsMonitored: locations.size,
        lastDetectionAt: latestAlert?.createdAt ?? null,
      }),
    );
  },
);

router.get(
  "/admin/reports",
  requireAdmin,
  async (req, res): Promise<void> => {
    const query = ListAdminReportsQueryParams.safeParse({
      location:
        typeof req.query.location === "string" ? req.query.location : undefined,
      symptom:
        typeof req.query.symptom === "string" ? req.query.symptom : undefined,
      from:
        typeof req.query.from === "string"
          ? new Date(req.query.from)
          : undefined,
      to: typeof req.query.to === "string" ? new Date(req.query.to) : undefined,
    });
    if (!query.success) {
      res.status(400).json({ error: query.error.message });
      return;
    }

    const filters = [];
    if (query.data.location) {
      filters.push(eq(reportsTable.locationName, query.data.location));
    }
    if (query.data.symptom) {
      filters.push(eq(reportsTable.symptom, query.data.symptom));
    }
    if (query.data.from) {
      filters.push(
        gte(reportsTable.reportDate, dateKey(query.data.from)),
      );
    }
    const rows = await db
      .select()
      .from(reportsTable)
      .innerJoin(usersTable, eq(reportsTable.submittedBy, usersTable.id))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(reportsTable.reportDate), desc(reportsTable.createdAt));
    const filtered = rows.filter(({ reports }) => {
      if (query.data.to && reports.reportDate > dateKey(query.data.to)) {
        return false;
      }
      return true;
    });
    res.json(
      ListAdminReportsResponse.parse(
        filtered.map(({ reports, users }) => toReportResponse(reports, users)),
      ),
    );
  },
);

router.get("/admin/alerts", requireAdmin, async (_req, res): Promise<void> => {
  const alerts = await db
    .select()
    .from(outbreakAlertsTable)
    .orderBy(desc(outbreakAlertsTable.zScore), desc(outbreakAlertsTable.alertDate));
  res.json(
    ListAlertsResponse.parse(
      alerts.map((alert) => ({
        ...alert,
        alertDate: new Date(`${alert.alertDate}T00:00:00Z`),
      })),
    ),
  );
});

router.post(
  "/admin/run-detection",
  requireAdmin,
  async (_req, res): Promise<void> => {
    const reports = await db.select().from(reportsTable);
    const groups = new Map<string, ReportRow[]>();
    for (const report of reports) {
      const key = `${report.locationName}::${report.symptom}`;
      groups.set(key, [...(groups.get(key) ?? []), report]);
    }

    const candidates = [];
    for (const [key, group] of groups) {
      const [location, symptom] = key.split("::");
      const trend = buildTrend(group, location, symptom);
      for (const point of trend.filter((item) => item.isAnomaly)) {
        const source = group[0];
        candidates.push({
          locationName: location,
          lat: source.lat,
          lng: source.lng,
          symptom,
          zScore: point.zScore ?? 0,
          alertDate: dateKey(point.date),
          severity:
            (point.zScore ?? 0) >= 4
              ? "critical"
              : (point.zScore ?? 0) >= 3
                ? "elevated"
                : "watch",
        });
      }
    }

    await db.delete(outbreakAlertsTable);
    if (candidates.length) {
      await db.insert(outbreakAlertsTable).values(candidates);
    }
    res.json(
      RunDetectionResponse.parse({
        alertsCreated: candidates.length,
        detectedAt: new Date(),
      }),
    );
  },
);

router.get(
  "/admin/heatmap-data",
  requireAdmin,
  async (_req, res): Promise<void> => {
    const reports = await db.select().from(reportsTable);
    const byLocation = new Map<
      string,
      { lat: number; lng: number; intensity: number }
    >();
    for (const report of reports) {
      const current = byLocation.get(report.locationName) ?? {
        lat: report.lat,
        lng: report.lng,
        intensity: 0,
      };
      current.intensity += report.patientCount;
      byLocation.set(report.locationName, current);
    }
    res.json(
      GetHeatmapDataResponse.parse(
        [...byLocation.entries()].map(([locationName, value]) => ({
          locationName,
          ...value,
        })),
      ),
    );
  },
);

router.get("/admin/sources", requireAdmin, async (_req, res): Promise<void> => {
  const sources = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.role, "source"))
    .orderBy(usersTable.sourceName);
  res.json(
    ListSourcesResponse.parse(
      sources.map((source) => ({
        id: source.id,
        email: source.email,
        role: source.role,
        sourceName: source.sourceName,
        sourceType: source.sourceType,
        locationName: source.locationName,
        lat: source.lat,
        lng: source.lng,
        createdAt: source.createdAt,
      })),
    ),
  );
});

router.get(
  "/admin/trends",
  requireAdmin,
  async (req, res): Promise<void> => {
    const query = GetTrendQueryParams.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: query.error.message });
      return;
    }
    const reports = await db.select().from(reportsTable);
    res.json(
      GetTrendResponse.parse(
        buildTrend(reports, query.data.location, query.data.symptom),
      ),
    );
  },
);

export default router;