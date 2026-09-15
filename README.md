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

### 3. Start PostgreSQL

```bash
docker compose up -d postgres
```

Copy the local environment template:

```bash
cp .env.example .env
```

Load the variables into your shell. On macOS/Linux:

```bash
set -a
source .env
set +a
```

On Windows PowerShell:

```powershell
Get-Content .env | ForEach-Object {
  if ($_ -match '^([^#][^=]*)=(.*)$') {
    Set-Item -Path "Env:$($matches[1])" -Value $matches[2]
  }
}
```

### 4. Create the database tables and demo data

```bash
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run seed
```

The seed command creates five reporting sources, 90 days of sample reports, and two injected outbreak windows.

### 5. Start the API

In terminal 1:

```bash
set -a
source .env
set +a
PORT=8080 pnpm --filter @workspace/api-server run dev
```

### 6. Start the web app

In terminal 2:

```bash
set -a
source .env
set +a
PORT=5173 BASE_PATH=/ API_SERVER_URL=http://localhost:8080 pnpm --filter @workspace/outbreaklens run dev
```

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