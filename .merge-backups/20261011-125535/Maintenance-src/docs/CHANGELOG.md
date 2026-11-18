## 2026-10-11

### Fixed
- **Login 500 after a valid AD bind**: `adService.resolveDepartment` assumed the AD `department` attribute was always a string, but ldapts returns multi-valued attributes as arrays, so `.trim()` threw `TypeError: directDepartment.trim is not a function`. Added a `firstString()` normalizer and applied it to `department`, `displayName`, `cn`, `mail`, `userPrincipalName`, and `objectSid`. Multi-valued AD attributes are now handled correctly.
- **CRITICAL — authentication bypass**: the application accepted any username with any password. Root cause: `AUTH_MODE=local` + `MOCK_AUTH=true` routed logins to a dev branch where `DEV_TEST_USERS[username] || {defaultProfile}` fabricated a valid user for *every* input and never checked the password, then auto-provisioned it into SQLite. Authentication now always goes through the real Active Directory (`adService.authenticateUser`), and fails closed.

### Changed
- `authService.js`: removed `isLocalMode()` and the entire mock branch; `authenticateUser()` now always calls `adService.authenticateUser()` and returns a user only after a successful AD bind.
- `authController.js`: `/login` regenerates the session ID on success (session-fixation protection); expected 401/502 failures are logged in one line without stack traces; `adStatus` always reports `authMode: 'ad'`.
- `adService.js`: escapes the LDAP search filter per RFC 4515 (LDAP-injection fix); supports `ldaps://` and optional `AD_STARTTLS=true` with no silent downgrade; optional `AD_TLS_REJECT_UNAUTHORIZED=false` (explicit only).
- `index.js`: startup configuration validation — production aborts on non-AD mode, `MOCK_AUTH`, or missing `AD_URL`/`AD_DOMAIN`/`AD_BASE_DN`; warns when using cleartext `ldap://` without StartTLS.
- `.env` and `.env.example`: `AUTH_MODE=ad`, mock auth removed, `AD_STARTTLS` documented.
- `LoginPage.jsx`: development quick-fill buttons now render only in dev builds (`import.meta.env.DEV`); corrected footer copy; removed misleading "Entra ID Sync" claim.
- Phase 1–4 test suites (`test-auth-flow.js`, `test-phase2-requests.js`, `test-phase3-management.js`, `test-phase4-execution.js`) now authenticate against the real AD using `test-helpers/adCredentials.js`; they print exactly which env vars to set and skip cleanly when credentials are absent (no mock fallback).
- `test-auth-security.js` now runs against an isolated copy of the database (`server/data/test-auth-security.db`) so it never writes test users/requests into the dev database.

### Removed
- `server/src/services/ldapService.js` (insecure duplicate that also contained the `MOCK_AUTH` catch-all).
- `GET /api/auth/dev-users` endpoint and `DEV_TEST_USERS`.

### Added
- `server/test-helpers/adCredentials.js`: per-role real-AD credential loader (`TEST_AD_<ROLE>_USER`/`_PASS`) with graceful skip.
- `server/test-auth-security.js`: 27-test suite covering the required authentication matrix (valid, nonexistent, wrong password, empty, AD unavailable, LDAP failure, injection, unauthenticated API, forged session, workflow intact), using an in-process AD test double only.
- `test-ad-integration.js`: live rejection test against the real AD (`401`, no cookie) and env-driven success test (`AD_TEST_USERNAME`/`AD_TEST_PASSWORD`).

### Data cleanup
- Removed all 11 mock/dev accounts auto-created during the vulnerable period (and their dependent test data): 11 users, 22 requests, 62 audit logs, 8 assignments, 4 comments, 1 attachment, 4 spare parts, 58 sessions. Reference data (roles, departments, categories) preserved.
- Backup written to `server/data/backups/maintenance-backup-<timestamp>.db` before deletion.


### Verified live
- `ADD-DC.metschool.local` reachable (24 ms) and positively identified as the `metschool.local` domain controller via rootDSE (`namingContexts: DC=metschool,DC=local`).
- Nonexistent user and mock credentials (`employee`/`password123`, `admin`/`password123`) now return `401` with no session cookie.

## 2026-10-10

### Added
- Design & branding system for **Metropolitan Maintenance System (MMS)**:
  - `docs/DESIGN_PROMPT.md`: adapted design prompt (MMS naming, `--mms-*` token names, 5-role dashboards, request-status/priority color language, "request" noun with `MNT-XXXXXX` ticket numbers).
  - Tailwind CSS v3 setup: `tailwind.config.js` with `mms`, `status`, `priority` color tokens, Manrope/Inter font families, and `postcss.config.js`.
  - Shared `components/Badge.jsx` (`StatusBadge`, `PriorityBadge`, `RoleBadge`) so status/priority/role pills are defined once.
  - Google Fonts (Manrope + Inter) and MMS page title in `index.html`.

### Changed
- Full UI re-theme from dark navy/blue theme to the light MMS design (purple `#693198` / gold / teal tokens):
  - Migrated all 12 JSX files (shell, navbar, login, dashboard, 6 modals) from `App.css` classes to Tailwind utilities.
  - Light components in `index.css` (`mms-input`, `mms-label`, `btn-*`, `card`, `badge`) replacing 1716 lines of dark-theme `App.css`.
  - White header/footer shell, hairline-border cards, purple focus rings, semantic status pills with text labels, calm error alerts (`role="alert"`).
  - Copy pass to terminology rule: noun = "request", identifier = "ticket number".

### Removed
- `client/src/App.css` (dark theme) and Vite-template dark-mode rules in `index.css`.

- Completed Phase 4 (Work Execution & Spare Parts):
  - Start work endpoint (`POST /api/requests/:id/start-work`) with worker assignment verification, optimistic concurrency control, and `WORK_STARTED` audit logging.
  - Work completion endpoint (`POST /api/requests/:id/complete`) with mandatory `actionTaken`, duration tracking in minutes (`maintenanceTime`), `finalReport`, and `WORK_COMPLETED` audit logging.
  - Spare parts requesting endpoint (`POST /api/requests/:id/spare-parts`) with quantity validation and `SPARE_PART_REQUESTED` audit logging.
  - Spare parts inventory queue endpoint (`GET /api/requests/spare-parts`) with status filtering (`PENDING` / `RELEASED`).
  - Spare parts release endpoint (`POST /api/requests/spare-parts/:partId/release`) for Storekeeper/Supervisor with `SPARE_PART_RELEASED` audit logging.
  - Storekeeper role metrics integrated in `GET /api/requests/stats` (`pendingSpareParts`, `releasedSpareParts`, `totalSpareParts`).
  - Automated Phase 4 test suite `server/test-phase4-execution.js` with 47/47 tests passing.
  - Interactive `RequestSparePartModal.jsx` with real-time quantity stepper and specification notes.
  - Interactive `CompleteWorkModal.jsx` with duration chips (15m, 30m, 45m, 1h, 2h), resolution textarea, and final verification notes.
  - Updated `RequestDetailModal.jsx` with Worker Action Bar (Start Work, Request Spare Parts, Complete Work), Work Execution Resolution card, and Spare Parts table with inline Storekeeper Release action.
  - Role-aware `DashboardPage.jsx` featuring dedicated Storekeeper Spare Parts Inventory Queue tab and metrics.
  - Added UI styling for execution cards, spare parts table, duration presets, and inventory queue tabs.

- Completed Phase 3 (Management & Assignments):
  - Role-aware dashboard statistics endpoint (`GET /api/requests/stats`).
  - Assignable workers listing endpoint (`GET /api/requests/workers`) restricted to Supervisor/Admin.
  - Request assignment endpoint (`POST /api/requests/:id/assign`) with optimistic concurrency control (`expectedCurrentStatus`) and assignment history recording in `request_assignments`.
  - Request rejection endpoint (`POST /api/requests/:id/reject`) with mandatory rejection reason and audit logging.
  - Request receipt endpoint (`POST /api/requests/:id/receive`) for supervisors.
  - Automated Phase 3 test suite `server/test-phase3-management.js` with 32/32 tests passing.
  - Role-specific dashboard layouts: Supervisor triage queue with aging indicators (<1h, 1-3h, 3h+), Worker assigned tasks view, and Employee my-requests view.
  - Interactive `AssignWorkerModal` with worker dropdown and workload badge.
  - Interactive `RejectRequestModal` with confirmation flow and reason input.
  - Interactive `RequestDetailModal` with Supervisor Action Bar (Assign, Reject, Mark Received), worker assignment details, rejection box, and audit trail timeline.
  - Modern UI styles for supervisor action bar, status badges, aging alerts, and responsive modal dialogs.

## 2026-10-08

### Added
- Completed Phase 2 (Maintenance Requests):
  - Sequential ticket numbering engine (`MNT-XXXXXX`) using transaction-safe counters.
  - Category and department seeders for school maintenance.
  - Multer upload middleware with 5MB validation.
  - Request service and controller with RBAC filtering, comment streams, and attachment downloads.
  - Automated Phase 2 test suite `server/test-phase2-requests.js` with 10/10 tests passing.
  - Interactive `CreateRequestModal`, `RequestDetailModal` with stepper and comments.
  - Employee dashboard with search, metrics, and filtering.

- Completed Phase 1 (Authentication & RBAC):
  - Direct LDAP authentication without service account via `ldapService.js`.
  - Development mock authentication for local development without domain controller.
  - Active Directory user synchronization to SQLite `users` table with department linking.
  - Session tracking service with `sessions` SQLite table.
  - Express session with `connect-sqlite3` store and CORS support.
  - Auth middleware (`requireAuth` and `requireRole` RBAC).
  - Auth endpoints: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/auth/dev-users`.
  - Automated authentication test suite `server/test-auth-flow.js` (all 8 tests passing).
  - Frontend authentication layer: `AuthContext`, `api.js` with credentials, `ProtectedRoute`.
  - Frontend components: `Navbar` with role badges, responsive `LoginPage` with quick-fill test users, and `DashboardPage`.

### Fixed
- Fixed Prisma 8 platform CLI mismatch by pinning stable Prisma 6.19.3.
- Fixed relative database path in `server/.env` for Prisma schema engine.
- Fixed SQL syntax error in `init-db.js` table creation script.
- Fixed Prisma schema relation names and back-relations across models.

## 2026-10-07

### Added
- Project foundation setup
- docs directory
- PROJECT_CONTEXT.md
- ARCHITECTURE.md
- SESSION_STATE.md
- TODO.md
- DECISIONS.md
- Git repository initialized
- .gitignore file
- Initial commit
- .env.example file
- Basic React + Express project structure
- Frontend dependencies installed
- Backend dependencies installed (express, prisma, sqlite3, @prisma/client)
- Prisma ORM initialized
- Initial database schema created (tables: roles, departments, maintenance_categories, users, maintenance_requests, request_assignments, request_comments, request_spare_parts, request_attachments, notifications, audit_logs)

### Changed
- None

### Fixed
- None