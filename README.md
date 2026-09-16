# OutbreakLens

OutbreakLens is a public-health surveillance demo. Clinics and pharmacies submit syndromic reports, while health officials review geographic signal intensity and run outbreak detection scans.

## Local setup

### Requirements

- Node.js 20+
- pnpm 10+
- Docker Desktop or another Docker-compatible runtime

### 1. Download the project

From Replit, use **Download as zip**, or clone the project repository:

```bash
git clone <your-repository-url>
cd <project-directory>
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure the environment

Copy the local environment template:

```bash
cp .env.example .env
```

### 4. Start the application

Start PostgreSQL, the API server, and the frontend web app with Docker Compose:

```bash
docker compose up --build
```

This command automatically starts the database, applies the schema, seeds the demo data (including five reporting sources, 90 days of sample reports, and two injected outbreak windows), and starts both the API and frontend development servers.

Open [http://localhost:5173](http://localhost:5173).

The local Vite proxy sends `/api` requests to the API server. In Replit, the managed routing handles `/api` automatically.

## Demo accounts

Admin:

- Email: `admin@outbreaklens.local`
- Password: `OutbreakLens2026!`

Source:

- Email: `northside@outbreaklens.local`
- Password: `Source2026!`

## Useful commands

```bash
pnpm run typecheck
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/api-server run seed
docker compose down
```

The dashboard uses Leaflet, `leaflet.heat`, and OpenStreetMap tiles. The map is rendered from live `/api/admin/heatmap-data` results and includes attribution in the map UI.