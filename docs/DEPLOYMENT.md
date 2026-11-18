# Deployment — Unified Metropolitan Ticketing System

The IT Ticketing System and the Maintenance Management System run as **one
application**: a single Express + Prisma backend (two Prisma schemas / two
Postgres databases) and a single React SPA. Authentication is a single
Active-Directory-backed **JWT** flow shared by both modules.

## Architecture

| Service | Image / build | Purpose |
| --- | --- | --- |
| `db` | `postgres:16-alpine` | One cluster, two databases: `ticketing` and `maintenance` |
| `backend` | `backend/Dockerfile` (Node 20) | Unified API mounted at `/api` (IT) and `/api/maintenance` |
| `web` | `frontend/Dockerfile` (Nginx) | Serves the SPA and reverse-proxies `/api` to `backend` |

- **IT module**: `/api/auth`, `/api/tickets`, `/api/dashboard`, `/api/comments`,
  `/api/departments`, `/api/categories`, `/api/users`.
- **Maintenance module**: `/api/maintenance/*`.
- Both modules resolve the same JWT principal. IT roles: `EMPLOYEE`, `TECHNICIAN`.
  Maintenance roles: `EMPLOYEE`, `SUPERVISOR`, `MAINTENANCE_WORKER`,
  `STORE_KEEPER`, `ADMIN`.

## Prerequisites

- Docker Engine / Docker Desktop with Compose v2.
- Network reachability from the host/container to the school AD/LDAP server.

## 1. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (generate with
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
- `POSTGRES_PASSWORD` (change from the dev placeholder).
- AD settings (`AD_URL`, `AD_BASE_DN`, `AD_DOMAIN`, group mappings).
- Email: `MICROSOFT_*` (Graph, preferred) or the `SMTP_*` fallback.

> The real `.env` is git-ignored. Never commit secrets.

## 2. Bring up the stack

```bash
docker compose up --build -d
docker compose logs -f backend
```

URLs:

- Web UI + API proxy: `http://localhost:8080`
- API direct (optional): `http://localhost:3000`
- Postgres: `localhost:5432`

On first start the backend **applies migrations for both databases** and seeds
reference data (roles, departments, categories) before serving. Set
`RUN_SEED=false` to skip seeding.

## Migrations (migration-on-deploy)

`backend/docker-entrypoint.sh` runs, in order:

```bash
npx prisma migrate deploy --schema prisma/schema.prisma                    # ticketing
npx prisma migrate deploy --schema maintenance/prisma/schema.prisma        # maintenance
npx tsx prisma/seed.ts                                                     # IT reference data
node maintenance/src/seed.js                                               # Maintenance reference data
```

Both `migrate deploy` calls are versioned and idempotent; seeds use upserts.

## Email

Notifications are sent through **Microsoft Graph** when
`MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` and
`MICROSOFT_SENDER_EMAIL` are all set (app-only `client_credentials` token →
`/users/{sender}/sendMail`). Otherwise the service falls back to SMTP when
`SMTP_HOST` and `MAIL_FROM` are set. If neither is configured, email is a safe
no-op.

## Backups & recovery

Back up both databases with `pg_dump`:

```powershell
powershell -File scripts/backup-databases.ps1
# custom container/out dir:
powershell -File scripts/backup-databases.ps1 -Container met-ticketing-pg -OutDir D:\backups
```

Each run writes `<out>/ticketing.sql`, `<out>/maintenance.sql`, a `GIT_REV.txt`
and updates `backups/LATEST.txt`.

Restore (stop the backend first):

```powershell
docker compose stop backend
powershell -File scripts/restore-databases.ps1 -BackupDir backups\20260101-120000
docker compose start backend
```

Maintenance request attachments live in the `mts_uploads` volume; back it up
separately if needed (e.g. `docker run --rm -v mts_uploads:/data -v ${PWD}:/out alpine tar czf /out/uploads.tgz -C /data .`).

## Regression test

With the backend reachable (`http://localhost:3000`):

```bash
cd backend
node test-unified-regression.js
```

It creates throwaway `verify.*` maintenance users, exercises the auth contract,
maintenance RBAC + full request lifecycle, and IT authorization, then removes
all rows it created.

For Active Directory sign-in and real group → role verification, see
[`docs/AD-VERIFICATION.md`](AD-VERIFICATION.md) (`node backend/test-ad-login.js`,
or `npm run test:ad`). AD-dependent checks SKIP until accounts are supplied in a
gitignored `backend/.env.test`.

## Operational notes

- The backend container auto-runs migrations on every start; scale the backend
  to a single replica (or disable seeding) to avoid concurrent migrations.
- `AD_STARTTLS=false` matches the on-prem `ldap://` DC. Keep `AD_CONNECT_TIMEOUT_MS`
  low (default 5000) so AD outages fail fast with `502` rather than hanging.
