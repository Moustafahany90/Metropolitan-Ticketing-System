## Completed
- [x] Project initialization
- [x] Created docs directory
- [x] Created PROJECT_CONTEXT.md
- [x] Created ARCHITECTURE.md
- [x] Created SESSION_STATE.md
- [x] Created CHANGELOG.md
- [x] Created TODO.md
- [x] Created DECISIONS.md
- [x] Initialized Git repository
- [x] Created .gitignore file
- [x] Made initial commit
- [x] Set up environment configuration (.env.example)
- [x] Created basic React + Express project structure
- [x] Installed frontend dependencies
- [x] Installed backend dependencies (express, prisma, sqlite3, @prisma/client)
- [x] Initialize Prisma ORM
- [x] Create initial database schema
- [x] Phase 1: Authentication
  - [x] Active Directory / LDAP direct bind authentication
  - [x] Development mode mock auth for disconnected testing
  - [x] Express session with SQLite store
  - [x] User synchronization from AD to database
  - [x] Application-level RBAC roles (EMPLOYEE, SUPERVISOR, MAINTENANCE_WORKER, STORE_KEEPER, ADMIN)
  - [x] Auth routes (/login, /logout, /me, /dev-users)
  - [x] Auth middleware (requireAuth, requireRole)
  - [x] React authentication context & protected routes
  - [x] Login page & Dashboard UI with quick role switching
- [x] Phase 2: Maintenance Requests
  - [x] Sequential ticket number generator (`MNT-XXXXXX`)
  - [x] Category & department seeding
  - [x] Multer file upload middleware with 5MB validation
  - [x] RequestService & RequestController with CRUD and RBAC filters
  - [x] Request endpoints (`/api/requests`, `/categories`, `/departments`, `/:id`, `/:id/comments`, `/attachments/:filename`)
  - [x] Automated Phase 2 backend test suite (`test-phase2-requests.js`) passing 10/10 tests
  - [x] Client requestService API module
  - [x] CreateRequestModal with categories, priority chips, location, description, file dropzone
  - [x] RequestDetailModal with 4-step workflow stepper, attachment download, and comment stream
  - [x] Interactive DashboardPage with metrics counters, search, category & status filter, ticket cards

- [x] Phase 3: Management
  - [x] Role-aware stats endpoint (`GET /api/requests/stats`)
  - [x] Available workers endpoint (`GET /api/requests/workers`)
  - [x] Worker assignment endpoint (`POST /api/requests/:id/assign`) with optimistic concurrency control
  - [x] Request rejection endpoint (`POST /api/requests/:id/reject`) with mandatory reason
  - [x] Request receipt endpoint (`POST /api/requests/:id/receive`)
  - [x] Assignment history (`request_assignments`) & audit logging
  - [x] Automated Phase 3 backend test suite (`test-phase3-management.js`) passing 32/32 tests
  - [x] Supervisor dashboard with pending triage queue, aging indicators, quick assign & reject
  - [x] Worker dashboard with assigned tickets queue
  - [x] Interactive `AssignWorkerModal` & `RejectRequestModal` integrated into `RequestDetailModal`
  - [x] Modern UI styling for supervisor action bar, audit trail, and aging badges

- [x] Phase 4: Work Execution & Spare Parts
  - [x] Start work endpoint (`POST /api/requests/:id/start-work`) with assignment verification and optimistic concurrency control
  - [x] Work completion endpoint (`POST /api/requests/:id/complete`) with required actionTaken, maintenanceTime, and finalReport
  - [x] Spare parts request endpoint (`POST /api/requests/:id/spare-parts`) with quantity validation
  - [x] Spare parts global listing (`GET /api/requests/spare-parts`) with status filter (PENDING, RELEASED)
  - [x] Spare parts release endpoint (`POST /api/requests/spare-parts/:partId/release`) for Storekeeper/Supervisor
  - [x] Storekeeper role metrics in `GET /api/requests/stats` (pending, released, total)
  - [x] Audit logging for work start, spare parts request, spare parts release, and work completion
  - [x] Automated Phase 4 test suite (`test-phase4-execution.js`) passing 47/47 tests
  - [x] Interactive `RequestSparePartModal` with live quantity stepper and specification input
  - [x] Interactive `CompleteWorkModal` with duration presets (15m, 30m, 45m, 1h, 2h) and resolution notes
  - [x] Updated `RequestDetailModal` with Worker Action Bar, execution meta card, spare parts table with inline release
  - [x] Storekeeper Dashboard tab with Spare Parts Inventory Queue and instant release action
  - [x] Verified zero regressions across all 4 automated test suites (Phase 1, 2, 3, 4)

## In Progress
- [ ] Phase 5: Microsoft Graph (email notifications)

## Security / Authentication
- [x] Enforce real Active Directory authentication (removed mock/local bypass)
- [x] Direct LDAP bind (ldapts) with fail-closed error handling (401 invalid, 502 AD down)
- [x] LDAP filter escaping (RFC 4515) — injection fix
- [x] Session ID regeneration on login (fixation protection)
- [x] Startup config validation + cleartext LDAP warning
- [x] `server/test-auth-security.js` (27/27) + live rejection test in `test-ad-integration.js` (25/25)
- [ ] Run real-AD success test with a valid school account (`AD_TEST_USERNAME` / `AD_TEST_PASSWORD`)
- [ ] Confirm with IT whether LDAPS (636) / StartTLS is supported; update `AD_URL` / `AD_STARTTLS`
- [x] Update Phase 1–4 suites to use real AD credentials (`test-helpers/adCredentials.js`; skip cleanly when absent)
- [x] Clean up dev mock users previously auto-created in `data/maintenance.db` (11 users + test data removed; backup saved)

## Design / Branding
- [x] docs/DESIGN_PROMPT.md (MMS-adapted design & branding prompt)
- [x] Tailwind CSS v3 setup with MMS design tokens (`tailwind.config.js`, `postcss.config.js`)
- [x] Shared Badge components (status, priority, role)
- [x] Re-theme all screens: login, navbar, dashboard, all 6 modals (dark → light MMS)
- [x] Remove App.css (dark theme), clean index.css
- [ ] Add logo file `client/public/logo/metropolitan-logo.png` (UI falls back to wrench icon until provided)
- [ ] Visual QA pass across all 5 roles (responsive 375/768/1024, contrast, focus rings)

## Next
- [ ] Phase 5: Microsoft Graph (email notifications)
- [ ] Phase 6: Production (deployment, backup, security review)