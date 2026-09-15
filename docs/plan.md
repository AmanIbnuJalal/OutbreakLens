# OutbreakLens — Vibecoding Build Plan

A phase-by-phase plan for building the local demo with an AI coding assistant (Claude Code, Cursor, etc.). Each phase is scoped to one sitting and one clear prompt — build and verify before moving to the next. Don't paste the whole plan into the assistant at once; feed it phase by phase so it doesn't rush ahead and produce something unreviewable.

## Roles & Auth Design

Two roles, one login system:

- **User (clinic/pharmacy)**: can only submit reports and view their own submission history. Cannot see other sources' data or alerts.
- **Admin (health official)**: sees everything — all reports, the map, alerts, source list. Can register new clinic/pharmacy accounts (or approve self-signups, your call).

Auth approach: JWT-based, FastAPI's `OAuth2PasswordBearer` + `python-jose` for tokens, `passlib[bcrypt]` for password hashing. Role stored as a field on the user record (`role: 'admin' | 'source'`), checked via a FastAPI dependency that gates each route.

## Tech Stack (confirmed)

FastAPI + PostgreSQL + SQLAlchemy + JWT auth on the backend; React + Leaflet + Recharts on the frontend; Docker Compose to run Postgres locally.

---

## Phase 1 — Project Skeleton & Auth

**Goal:** Login works, roles are enforced, nothing else yet.

Build:
- FastAPI project structure (`app/models`, `app/routers`, `app/core`, `app/schemas`)
- `docker-compose.yml` with a Postgres service
- `User` model: `id, email, hashed_password, role, source_name, created_at`
- `POST /auth/register` (creates a `source` user — admin account seeded manually via a script)
- `POST /auth/login` (returns JWT)
- `GET /auth/me` (returns current user, tests the token)
- Two FastAPI dependencies: `get_current_user`, `require_admin`

**Vibecoding prompt to give the assistant:**
> "Set up a FastAPI project with SQLAlchemy + PostgreSQL (via docker-compose), and a JWT-based auth system with two roles: 'admin' and 'source'. Include register, login, and a /me endpoint. Add a `require_admin` dependency that 403s non-admins. Include a seed script that creates one admin user with a fixed password for local testing."

**Verify before moving on:** register a source user, log in, hit `/me`, confirm `/auth/register` for admin-only routes is blocked without the role.

---

## Phase 2 — Report Submission (source role)

**Goal:** Logged-in clinic/pharmacy users can submit data; it's tied to their account.

Build:
- `Report` model: `id, submitted_by (FK to user), source_type, location_name, lat, lng, symptom, patient_count, medicine_name (nullable), units_sold (nullable), report_date`
- `POST /reports` — source-only, auto-attaches `submitted_by` from the JWT
- `GET /reports/mine` — source-only, returns their own submission history

**Vibecoding prompt:**
> "Add a Report model and a POST /reports endpoint restricted to users with role 'source'. The submitted_by field should be set automatically from the authenticated user, not passed in the request body. Add GET /reports/mine returning only that user's past submissions, newest first."

**Verify:** submit a few reports as a source user, confirm they show up under `/reports/mine`, confirm a source user can't see another source's reports.

---

## Phase 3 — Dummy Data Seeding

**Goal:** Enough historical data to make detection and the map meaningful.

Build a standalone seed script (not an API endpoint) that:
- Creates 4-6 fake source accounts (clinics/pharmacies) across a few locations
- Generates ~90 days of baseline reports (Poisson-distributed daily counts) per location/symptom
- Injects 2-3 artificial outbreak windows (3-5x spike over 5-7 days at a specific location/symptom) so detection has something real to catch

**Vibecoding prompt:**
> "Write a standalone Python seed script (not an API route) that creates 5 fake source accounts across different towns, and generates 90 days of dummy Report rows per location/symptom combo using a Poisson baseline. Inject 2 artificial outbreak spikes (3-5x baseline for 5-7 consecutive days) at specific location+symptom pairs, and print out exactly which ones so I can verify detection later."

**Verify:** query the DB directly, confirm row counts and that the outbreak windows exist.

---

## Phase 4 — Anomaly Detection (admin-only)

**Goal:** Turn raw reports into alerts.

Build:
- `OutbreakAlert` model: `id, location_name, lat, lng, symptom, z_score, alert_date, severity`
- A detection function: rolling z-score over a 14-21 day trailing window per (location, symptom), threshold ~2.5-3
- `POST /admin/run-detection` — admin-only, runs detection over all reports, writes new rows into `outbreak_alerts`
- `GET /admin/alerts` — admin-only, returns alerts

**Vibecoding prompt:**
> "Implement anomaly detection using pandas: for each (location, symptom) pair, compute a rolling mean and std over a 14-day trailing window, calculate a z-score for each day, and flag days where z-score exceeds 2.5 as OutbreakAlert rows. Add an admin-only POST endpoint to trigger detection and a GET endpoint to list alerts, ordered by z-score descending."

**Verify:** run detection, confirm the alerts it generates match the outbreak windows you injected in Phase 3.

---

## Phase 5 — Admin Views (map + dashboard data)

**Goal:** Endpoints the frontend map/dashboard will consume.

Build:
- `GET /admin/reports` — admin-only, all reports across all sources, with query filters (location, symptom, date range)
- `GET /admin/heatmap-data` — aggregated counts per location, for the Leaflet heatmap layer
- `GET /admin/sources` — list of registered clinic/pharmacy accounts

**Vibecoding prompt:**
> "Add three admin-only endpoints: GET /admin/reports with optional query filters for location, symptom, and date range; GET /admin/heatmap-data returning aggregated {lat, lng, intensity} points per location for a heatmap; and GET /admin/sources listing all registered source accounts."

---

## Phase 6 — Frontend: Auth + Role-Based Routing

**Goal:** Login screen, JWT stored, routes split by role.

Build:
- React app with React Router
- Login page → stores JWT (in memory / context, not localStorage if you want to avoid the artifact-storage caveat — for a demo running outside Claude artifacts this is fine either way)
- `AuthContext` that decodes role from the token and redirects: `source` → submission form, `admin` → dashboard
- Protected route wrapper

**Vibecoding prompt:**
> "Build a React app with a login page that calls POST /auth/login, stores the JWT, and decodes the role claim. Add a ProtectedRoute component that redirects unauthenticated users to /login, and redirects based on role: 'source' users to /submit, 'admin' users to /dashboard."

---

## Phase 7 — Frontend: Source Submission Form

**Goal:** Clinics/pharmacies can submit a report.

Build: a simple form (symptom dropdown, patient count, medicine name/units for pharmacies, location auto-filled from their account) posting to `/reports`, plus a table of their own past submissions from `/reports/mine`.

**Vibecoding prompt:**
> "Build a form page for source-role users to submit a report (symptom, patient count, optional medicine name and units sold) and a table below it showing their past submissions from GET /reports/mine."

---

## Phase 8 — Frontend: Admin Dashboard

**Goal:** The demo centerpiece — map + alerts + trend chart.

Build:
- Leaflet map (react-leaflet) with `Leaflet.heat` for the heatmap layer, colored markers for active alerts
- Alert feed list (from `/admin/alerts`), sorted by severity/z-score
- A Recharts line chart showing trend for a selected location/symptom, with the detected anomaly point highlighted
- A "Run Detection" button hitting `/admin/run-detection` live, for demo effect

**Vibecoding prompt:**
> "Build an admin dashboard with a react-leaflet map using the Leaflet.heat plugin fed by GET /admin/heatmap-data, colored markers for entries from GET /admin/alerts, a Recharts line chart showing report trends for a selected location/symptom with the anomaly point highlighted, and a button that calls POST /admin/run-detection and refreshes the alert feed."

---

## Phase 9 — Demo Polish

- Seed script prints a short "cheat sheet" of admin login + which location/symptom has the injected outbreak, so you don't fumble the demo
- Optional: a `/admin/reset-demo` endpoint that wipes and re-seeds, so you can re-run the demo live without restarting Docker

---

## Order matters

Auth first, then data flow (submit → store), then detection, then visualization. Don't let the assistant jump to building the map before login and role gating actually work — that's the part most likely to break under demo pressure, so get it solid early and stop touching it once it passes Phase 1's verification step.
