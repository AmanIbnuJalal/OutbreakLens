# OutbreakLens

OutbreakLens helps clinics and pharmacies submit syndromic reports while health officials monitor geographic signals and detected outbreak anomalies.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for auth, reporting, alerts, and dashboard API contracts.
- `lib/db/src/schema/` — Drizzle schema for users, reports, and outbreak alerts.
- `artifacts/api-server/src/routes/` — Express API routes.
- `artifacts/outbreaklens/src/` — React frontend with role-gated auth, source reporting, and admin dashboard.
- `artifacts/api-server/src/seed.ts` — local demo data generator.

## Architecture decisions

- Local JWT auth is intentional for this demo because the product plan explicitly calls for source/admin roles and bearer-token flows.
- The API server is shared under `/api`; the frontend uses generated OpenAPI hooks rather than handwritten request types.
- Report ownership and source location are derived from the authenticated source account on the server.
- Detection stores alert snapshots and recomputes them when an admin runs the scan, keeping the demo repeatable.

## Product

- Source users can register, sign in, submit symptom reports, and review their own history.
- Admin users can review network metrics, reporting sources, heatmap points, trends, and anomaly alerts.
- The seeded local demo includes five sources, 90 days of reports, and two injected outbreak windows.

## User preferences

No additional preferences recorded.

## Gotchas

- `SESSION_SECRET` must be available for API authentication.
- Run `pnpm --filter @workspace/api-server run seed` to reset local demo data and regenerate the injected outbreak windows.
- After changing `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
