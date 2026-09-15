import { db, pool, outbreakAlertsTable, reportsTable, usersTable } from "@workspace/db";
import { hashPassword } from "./lib/auth";
import { logger } from "./lib/logger";

const symptoms = ["respiratory", "fever", "gastrointestinal"];
const sources = [
  {
    email: "northside@outbreaklens.local",
    sourceName: "Northside Family Clinic",
    sourceType: "clinic",
    locationName: "Bengaluru North",
    lat: 13.0358,
    lng: 77.597,
  },
  {
    email: "lakeview@outbreaklens.local",
    sourceName: "Lakeview Pharmacy",
    sourceType: "pharmacy",
    locationName: "Bengaluru East",
    lat: 12.9784,
    lng: 77.6408,
  },
  {
    email: "cantonment@outbreaklens.local",
    sourceName: "Cantonment Health Centre",
    sourceType: "clinic",
    locationName: "Bengaluru Central",
    lat: 12.9982,
    lng: 77.5946,
  },
  {
    email: "hillside@outbreaklens.local",
    sourceName: "Hillside Pharmacy",
    sourceType: "pharmacy",
    locationName: "Bengaluru South",
    lat: 12.925,
    lng: 77.5838,
  },
  {
    email: "greenpark@outbreaklens.local",
    sourceName: "Green Park Clinic",
    sourceType: "clinic",
    locationName: "Bengaluru West",
    lat: 12.988,
    lng: 77.55,
  },
];

function poisson(lambda: number): number {
  let k = 0;
  let probability = 1;
  const threshold = Math.exp(-lambda);
  while (probability > threshold) {
    k += 1;
    probability *= Math.random();
  }
  return Math.max(0, k - 1);
}

function calendarDate(daysAgo: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

async function seed(): Promise<void> {
  await db.delete(outbreakAlertsTable);
  await db.delete(reportsTable);
  await db.delete(usersTable);

  const [admin] = await db
    .insert(usersTable)
    .values({
      email: "admin@outbreaklens.local",
      hashedPassword: hashPassword("OutbreakLens2026!"),
      role: "admin",
      sourceName: "Public Health Operations",
      sourceType: "clinic",
      locationName: "Bengaluru",
      lat: 12.9716,
      lng: 77.5946,
    })
    .returning();

  const createdSources = await db
    .insert(usersTable)
    .values(
      sources.map((source) => ({
        ...source,
        role: "source",
        hashedPassword: hashPassword("Source2026!"),
      })),
    )
    .returning();

  const rows = [];
  for (const [sourceIndex, source] of createdSources.entries()) {
    for (let daysAgo = 89; daysAgo >= 0; daysAgo -= 1) {
      for (const symptom of symptoms) {
        const isRespiratorySpike =
          source.locationName === "Bengaluru North" &&
          symptom === "respiratory" &&
          daysAgo >= 18 &&
          daysAgo <= 12;
        const isFeverSpike =
          source.locationName === "Bengaluru South" &&
          symptom === "fever" &&
          daysAgo >= 43 &&
          daysAgo <= 37;
        const baseline = symptom === "respiratory" ? 5 : symptom === "fever" ? 4 : 3;
        const multiplier = isRespiratorySpike || isFeverSpike ? 4 : 1;
        const patientCount = Math.max(1, poisson(baseline * multiplier));
        rows.push({
          submittedBy: source.id,
          sourceType: source.sourceType,
          locationName: source.locationName,
          lat: source.lat,
          lng: source.lng,
          symptom,
          patientCount,
          medicineName: source.sourceType === "pharmacy" ? "General relief" : null,
          unitsSold:
            source.sourceType === "pharmacy" ? patientCount + sourceIndex : null,
          reportDate: calendarDate(daysAgo),
        });
      }
    }
  }
  await db.insert(reportsTable).values(rows);

  logger.info(
    {
      adminEmail: admin.email,
      adminPassword: "OutbreakLens2026!",
      sourcePassword: "Source2026!",
      rows: rows.length,
      injectedOutbreaks: [
        "Bengaluru North / respiratory / last 18-12 days",
        "Bengaluru South / fever / last 43-37 days",
      ],
    },
    "OutbreakLens demo data seeded",
  );
  await pool.end();
}

seed().catch((error) => {
  logger.error({ error }, "Failed to seed OutbreakLens demo data");
  process.exitCode = 1;
});