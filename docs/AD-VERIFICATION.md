# Active Directory Authentication & RBAC Verification

This document explains how to prove that **real Active Directory users** sign in to the
Unified School Support Portal and receive exactly the IT ticketing and Maintenance roles
their AD group membership dictates — and that the running API enforces those roles.

Two scripts do the work:

| Script | What it covers | Needs real AD accounts? |
| --- | --- | --- |
| `backend/test-unified-regression.js` | Whole-app functional regression (auth contract, maintenance workflow, RBAC via minted JWTs). The "always green" baseline: **42 checks**. | No |
| `backend/test-ad-login.js` | AD login + group → role matrix + identity edge cases + unreachable-AD fail-closed. AD-dependent sections **SKIP** until credentials exist. | Partly |

Neither script modifies Active Directory. Neither prints passwords or tokens.

---

## 1. How roles are derived

A user's module role is the highest-priority match across their AD group memberships.

**IT ticketing** (`AD_TECHNICIAN_GROUPS`, default `IT`):
- member of any listed group -> `TECHNICIAN`
- otherwise -> `EMPLOYEE`

**Maintenance** (priority `ADMIN > SUPERVISOR > MAINTENANCE_WORKER > STORE_KEEPER > EMPLOYEE`):
- `AD_ADMIN_GROUPS` -> `ADMIN`
- `AD_SUPERVISOR_GROUPS` -> `SUPERVISOR`
- `AD_WORKER_GROUPS` -> `MAINTENANCE_WORKER`
- `AD_STOREKEEPER_GROUPS` -> `STORE_KEEPER`
- otherwise -> `EMPLOYEE`

**Departments** (`AD_DEPARTMENT_GROUPS`, format `GroupCN=Canonical Name`):
- names must match the seed (`backend/maintenance/seed.js`); anything else creates a
  duplicate department.

The two modules do **not** grant each other access. One login can carry different roles in
each module (see the dual-role account below).

### Enforced authorization (verified by the suite)

IT ticketing — technician-only:
- `PATCH /api/tickets/:id/status`
- `PATCH /api/tickets/:id/assign`
- `GET /api/users/technicians`

Maintenance:
- `assign` / `reject` / `receive` / worker list -> SUPERVISOR or ADMIN
- `start-work` / `complete` / spare-part request -> assigned WORKER, SUPERVISOR or ADMIN
- spare-part `release` -> STORE_KEEPER, SUPERVISOR or ADMIN

`ADMIN` passes every maintenance role gate; it does not grant IT technician access.

---

## 2. Prerequisites

1. Backend running and reachable (dev `http://localhost:3000`, or Compose `http://localhost:3001`).
2. The backend can reach the domain controller over LDAP (`AD_URL`) — the API exposes
   reachability at `/api/ad/status` (probe only) and the suite warns if it is down.
3. Both databases migrated and seeded (Compose entrypoint does this automatically).
4. `backend/.env` has valid `AD_*`, `JWT_ACCESS_SECRET`, and database URLs.
5. Node 18+ (the scripts use global `fetch`).

---

## 3. Provide test credentials

Credentials live in a **gitignored** file: `backend/.env.test`.

```powershell
Copy-Item backend/.env.test.example backend/.env.test
```

Fill in one account per row (`<KEY>_USERNAME` / `<KEY>_PASSWORD`). Leave a row blank to
SKIP just that case. Keys:

| Key | Expected IT role | Expected Maintenance role |
| --- | --- | --- |
| `IT_EMPLOYEE` | `EMPLOYEE` | `EMPLOYEE` |
| `IT_TECHNICIAN` | `TECHNICIAN` | `EMPLOYEE` |
| `MAINT_SUPERVISOR` | `EMPLOYEE` | `SUPERVISOR` |
| `MAINT_WORKER` | `EMPLOYEE` | `MAINTENANCE_WORKER` |
| `MAINT_STOREKEEPER` | `EMPLOYEE` | `STORE_KEEPER` |
| `MAINT_ADMIN` (optional) | `EMPLOYEE` | `ADMIN` |
| `DUAL` | `TECHNICIAN` | `SUPERVISOR` |
| `MIXEDCASE` | — | mixed-case identity regression |

If a test account deliberately differs from the defaults, override with
`<KEY>_EXPECT_IT_ROLE`, `<KEY>_EXPECT_IT_LABEL`, `<KEY>_EXPECT_MAINT_ROLE`,
`<KEY>_EXPECT_DEPARTMENT`.

> `.env.test` is ignored via `.gitignore` (`.env.test`, `*.env.test`, `backend/.env.test`).
> Never commit real credentials.

---

## 4. Run

```powershell
# From the repo root or backend/:
node backend/test-unified-regression.js                 # baseline, expect 42/42
node backend/test-ad-login.js                           # AD suite
node backend/test-ad-login.js --base-url http://localhost:3001
```

`package.json` shortcuts (in `backend/`):

```powershell
npm run test:unified
npm run test:ad
```

Exit code is non-zero if any check fails.

---

## 5. What the AD suite verifies

- **A. Preflight** — backend reachable, AD reachable, both DBs reachable.
- **B. Authentication contract** — missing fields -> 400, invalid refresh -> 401/400,
  logout idempotent.
- **C. Access-token handling** — no / malformed / expired / wrong-secret token -> 401.
- **D. Negative AD cases** — unknown user -> 401; wrong password -> 401; identical generic
  message for both (no account enumeration).
- **E. IT RBAC** — employee blocked (403), technician allowed; technician-only routes.
- **E2. Maintenance RBAC** — full role matrix against throwaway fixtures (created and
  deleted by the suite).
- **F. Username normalization** — a lower-cased vs mixed-case identity must resolve to the same maintenance user.
- **G. Department mapping** — every `GroupCN=Name` maps to a seeded canonical department.
- **H. AD role matrix** — each account's `/api/auth/me` (IT) and maintenance `/stats` role/department match expectations; no AD group DN leaks into responses.
- **I. Unreachable AD** — an isolated throwaway backend pointed at a dead LDAP endpoint returns **502** (fail-closed, not a 500 or a bypass).

### Interpreting output

- `PASS` — verified.
- `SKIP` — prerequisites missing (usually no credentials, or AD unreachable). Not a failure.
- `FAIL` — regression; the script exits non-zero.

A run with **zero credentials** still exercises A–G and I and must end:
`41 passed, 0 failed, 10 skipped`.

A fully-populated run should end `0 failed` with no SKIPs in section H.

---

### 5.1 The two identity bugs this suite guards against

These were confirmed and fixed; the suite fails if either regresses.

1. **Username case.** Maintenance stores usernames lower-cased, but the shared JWT
   principal may carry the domain's original casing (e.g. `John.Doe`). Identity lookups are
   now normalized at the boundary (`getUserByUsername` lower-cases defensively;
   `auth.service.ts` reconciles the cross-module user case-insensitively on login).
   Guarded by sections F and the `MIXEDCASE` account.
2. **Department name mismatch.** `AD_DEPARTMENT_GROUPS` used `High School Education`, which
   is not the seeded canonical name (`Secondary Education`), so matching users ended up in a
   duplicate department. Fixed in `.env` / `.env.example` / `backend/.env`. Guarded by
   section G.

---

## 6. Security notes

- LDAP is currently plaintext (`ldap://` + `AD_STARTTLS=false`). Credentials for the
  service bind cross the LAN unencrypted. **Recommended:** enable LDAPS/StartTLS
  (`ldaps://` on 636, or `AD_STARTTLS=true`) and point `AD_URL` accordingly. The suite
  treats this as an infra risk to document only — it does not change AD or the DC.
- Login errors are intentionally generic (no user enumeration). Keep it that way.
- Do not log tokens, passwords, or full DNs. The scripts deliberately avoid this.
- The unreachable-AD check proves fail-closed behavior: when AD cannot be contacted,
  login returns 502 rather than granting access.

---

## 7. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `AD reachability probe — unreachable` | `AD_URL` wrong, DC down, or backend off the LAN. AD sections will SKIP. |
| Section H all SKIP | `backend/.env.test` missing or rows blank. |
| `401` on a correct password | Account locked/expired, wrong `AD_DOMAIN`, or bind DN/`AD_USER_SEARCH_BASE` misconfigured. |
| Wrong role for an account | Group name case/whitespace; `AD_*_GROUPS` must match `sAMAccountName`/CN exactly (case-insensitive). Check section H output. |
| Section G fails | A mapped department name is not a seeded canonical name -> duplicate department. |
| Section F fails | Username normalization regressed in `authService`/`auth.service`. |
| `502` seen outside section I | The live backend could not reach AD — verify `AD_URL`. |
