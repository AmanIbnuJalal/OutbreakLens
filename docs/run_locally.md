## Run locally

### Requirements

- Node.js 20+
- pnpm 10+
- Docker Desktop

### Commands

```bash
pnpm install
docker compose up -d postgres
cp .env.example .env
```

Load the environment variables:

```bash
set -a
source .env
set +a
```

Create tables and seed demo data:

```bash
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run seed
```

Start the API in terminal 1:

```bash
set -a
source .env
set +a
PORT=8080 pnpm --filter @workspace/api-server run dev
```

Start the frontend in terminal 2:

```bash
set -a
source .env
set +a
PORT=5173 BASE_PATH=/ API_SERVER_URL=http://localhost:8080 pnpm --filter @workspace/outbreaklens run dev
```

Then open:

```text
http://localhost:5173
```
