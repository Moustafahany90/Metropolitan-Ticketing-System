# Current Session

Date: 2026-10-11

Current Phase: PHASE 5 — MICROSOFT GRAPH (EMAIL NOTIFICATIONS) — on hold; session spent on the **critical Active Directory authentication fix**

What was completed:
1. Root-caused a critical authentication bypass: `AUTH_MODE=local` + `MOCK_AUTH=true` sent logins to a dev branch where `DEV_TEST_USERS[username] || {defaultProfile}` fabricated a valid user for ANY username and never verified the password, then auto-provisioned it into SQLite. Result: nonexistent user + any password → `200` + session.
2. Enforced real AD authentication:
   - `authService.js`: removed `isLocalMode()` and the mock branch; `authenticateUser()` always calls `adService.authenticateUser()` and returns a user only after a successful AD bind (fail closed).
   - Deleted insecure duplicate `server/src/services/ldapService.js` (also contained the mock catch-all and `DEV_TEST_USERS`).
   - Removed `GET /api/auth/dev-users` and `DEV_TEST_USERS`.
3. Hardened `adService.js`: RFC 4515 LDAP filter escaping (injection fix), `ldaps://` support, optional `AD_STARTTLS=true` (no silent downgrade), optional explicit `AD_TLS_REJECT_UNAUTHORIZED=false`, unchanged fail-closed error classification (401 invalid / 502 unreachable).
4. `authController.js`: session ID regeneration on login (fixation protection); single-line logging for expected 401/502 (no password, no stack); `adStatus` always `authMode: 'ad'`.
5. `index.js`: `validateAuthConfig()` — production aborts on non-AD mode, `MOCK_AUTH`, or missing `AD_URL`/`AD_DOMAIN`/`AD_BASE_DN`; warns on cleartext `ldap://`.
6. Config: `.env` and `.env.example` set `AUTH_MODE=ad`, removed mock auth, documented `AD_STARTTLS`.
7. Client: `LoginPage.jsx` dev quick-fill now renders only when `import.meta.env.DEV`; corrected footer copy (removed "Entra ID Sync").
8. Tests: added `server/test-auth-security.js` (27/27 passing with an in-process AD test double); updated `test-ad-integration.js` for real-AD env credentials + live rejection (25/25 passing).
9. Verified live: server restarted and now enforces AD; nonexistent user and old mock creds return 401 with no cookie.

Files changed:
1. server/src/services/authService.js (mock branch removed)
2. server/src/services/adService.js (escaping, TLS, exports)
3. server/src/services/ldapService.js (deleted)
4. server/src/controllers/authController.js (session regen, logging, adStatus, dev-users removed)
5. server/src/routes/auth.js (/dev-users removed)
6. server/index.js (startup validation, log text)
7. server/.env, .env.example (AUTH_MODE=ad, no mock, AD_STARTTLS)
8. client/src/pages/LoginPage.jsx (dev-gated quick fill, footer)
9. server/test-auth-security.js (new)
10. server/test-ad-integration.js (real-AD success via env + live rejection)
11. server/test-helpers/adCredentials.js (new — per-role real-AD credential loader)
12. server/test-auth-flow.js, test-phase2-requests.js, test-phase3-management.js, test-phase4-execution.js (real-AD credentials + graceful skip)
13. server/test-auth-security.js (isolated test DB copy)
14. Cleaned mock/dev users from `data/maintenance.db` (backup in `server/data/backups/`)
15. docs/CHANGELOG.md, docs/TODO.md, docs/DECISIONS.md, docs/SESSION_STATE.md

What was tested:
1. `node test-auth-security.js` — 27/27 PASS. Cases: valid→200, nonexistent→401, wrong password→401, empty→400 (x3), AD down→502, LDAP failure→502, injection username→401 + RFC 4515 escaping unit tests, protected API without session→401, forged session→401, authenticated create request→201.
2. `node test-ad-integration.js` — 25/25 PASS against the LIVE AD (reachability/rootDSE, role/dept resolution, SID parse, ad-status, empty→400, nonexistent→401 live, error mapping). Real-AD success test SKIPPED (no credentials).
3. Live server probe: `POST /api/auth/login` with nonexistent user, `employee`, `admin` → all 401, no cookie. `/api/auth/ad-status` → reachable, 24 ms.
4. `ADD-DC.metschool.local` rootDSE identified as real DC: namingContexts `DC=metschool,DC=local`, dnsHostName `ADD-DC.metschool.local`.
5. Client `npm run lint` → 0 errors; `npm run build` → success; LoginPage module compiles in dev.

Working:
- Authentication now exclusively via real AD; every invalid/failure path fails closed (no fallback).
- Workflow intact for an authenticated user (request creation verified end-to-end).

Not working / unverified:
- Real-AD **success** login not executed (no valid school account available) — requires `AD_TEST_USERNAME`/`AD_TEST_PASSWORD`.
- TLS not configured (DC TLS support unconfirmed); currently cleartext `ldap://:389` with a startup warning.
- Phase 1–4 suites now require real AD credentials via `TEST_AD_<ROLE>_USER`/`_PASS` and skip until provided (they no longer use mock).

Known issues:
1. Pre-existing client lint warnings (effect deps, Date in render) remain.
2. Cleartext LDAP on port 389 until IT confirms LDAPS/StartTLS.

Important decisions made:
1. No mock/local auth in any environment (removed entirely) — fail closed.
2. Bind with the user's own credentials, then search using that session (no service account exists).
3. LDAP filter escaping per RFC 4515; session ID regeneration on login.
4. Keep `ldap://:389` + warning; add `ldaps://`/StartTLS support so IT can enable without code changes.
5. Phase suites use env-provided real-AD credentials and skip cleanly when absent.
6. Security test runs against an isolated DB copy so it never pollutes the dev database.

Current blockers:
- A valid school AD test account (username/password) to run the real success test.

Next exact task:
1. Obtain a test AD account; run `AD_TEST_USERNAME=<u> AD_TEST_PASSWORD=<p> node test-ad-integration.js`.
2. Provide per-role accounts and run Phase 1–4 suites.
3. Confirm with IT whether the DC supports LDAPS (636) or StartTLS; set `AD_URL`/`AD_STARTTLS`.
4. Resume Phase 5 (Microsoft Graph email notifications).

Commands needed to continue:
```
# backend
cd server && node index.js
# security tests
cd server && node test-auth-security.js
# live AD integration (needs credentials)
cd server && $env:AD_TEST_USERNAME="<user>"; $env:AD_TEST_PASSWORD="<pass>"; node test-ad-integration.js
# frontend
cd client && npm run dev
```
