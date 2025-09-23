# Employee Dashboard Cleaned Monorepo

This repository is a **cleaned up** and modernised version of an
internal employee dashboard. The original project used QuickBooks
authentication flows that were hard‑coded into the front‑end and
backend. In this version all QuickBooks OAuth logic has been removed.
Instead, a simple PostgreSQL–backed token manager provides access
tokens via a shared library.

## Highlights

- 🧱 **Monorepo layout** — apps and packages live side by side under
  `apps/` and `packages/`. Shared logic (e.g. token management) is in
  `packages/qbo-token-manager`.
- 🖥️ **API server** — `apps/server` runs an Express API that exposes
  `/api/employees` and `/api/token`. The only stateful dependency is a
  PostgreSQL database.
- 🕒 **Background refresher** — `apps/refresher` is a tiny worker that
  periodically stores a new token in the database. In a real system
  this worker would call QuickBooks to refresh an access token. Here
  it simply writes a placeholder value on a configurable interval.
- 🌐 **Next.js front‑end** — `apps/web` is a Next.js 14 app that
  displays the list of employees and the current token. It consumes
  the API directly via relative `/api/...` routes.
- 🐳 **Docker support** — A single multi‑stage Dockerfile builds all
  workspaces. The docker-compose file spins up Postgres, the API,
  refresher and front‑end services with sensible health checks and
  restart policies.

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/employee-dashboard-clean.git
   cd employee-dashboard-clean
   ```

2. **Configure environment variables**
   Copy the example `.env` into place and adjust credentials as needed:
   ```bash
   cp infra/docker/.env.example infra/docker/.env
   # Edit infra/docker/.env to change database credentials, ports, etc.
   ```

3. **Start the stack** (requires Docker and Docker Compose)
   ```bash
   cd infra/docker
   docker compose build
   docker compose up -d
   ```
   This will start Postgres, the API on port 3000, the front‑end on
   port 5173 and a background worker that updates tokens every 45
   minutes.

4. **View the dashboard**
   Visit http://localhost:5173 in your browser. You should see the
   employee list (empty on first run) and a placeholder token. Use a
   SQL tool to insert employees into the `employees` table to see them
   show up.

5. **Add your own logic**
   - To store a real QuickBooks token, modify `apps/refresher/src/index.ts`
     to call the QuickBooks API and use `upsertToken()` from
     `@wmx/qbo-token-manager`.
   - Extend the API with new routes in `apps/server/src/index.ts`.
   - Style the UI by editing `apps/web/app/page.tsx` or adding
     components under `apps/web/app`.

## Database Schema

For this project to function you need two tables:

```sql
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  department VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS qbo_tokens (
  id INTEGER PRIMARY KEY,
  token TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Ensure only a single row exists by enforcing id = 1
INSERT INTO qbo_tokens (id, token) VALUES (1, 'initial-token')
  ON CONFLICT (id) DO NOTHING;
```

You can run these statements against the `db` service once it is up
using `psql`:

```bash
docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "<SQL here>"
```

## Notes

- This repository assumes you have **pnpm** installed. The Dockerfile
  enables corepack and prepares pnpm automatically when building images.
- The front‑end uses the Next.js **app router** (`apps/web/app`).
  Components run on the client by default due to the `"use client"` directive.
- To integrate with a real QuickBooks environment, supply valid
  credentials and implement the OAuth flow in the worker or API.

Enjoy your clean, container‑ready employee dashboard! If you run into
issues or have suggestions for improvement, feel free to open an issue or
submit a pull request.