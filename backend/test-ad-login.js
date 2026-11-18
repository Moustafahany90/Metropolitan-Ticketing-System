#!/usr/bin/env node
/**
 * =============================================================================
 * AD authentication & end-to-end RBAC verification
 * =============================================================================
 *
 * Verifies that real domain users receive the correct IT + Maintenance roles
 * from their Active Directory group membership, and that authorization is
 * enforced by the *actual* API routes/middleware.
 *
 * The suite is split into two halves:
 *   - AD-independent : auth contract, token handling, RBAC (via minted host
 *                      JWTs, exactly like test-unified-regression.js), the
 *     username-normalization regression and the department-mapping regression.
 *   - AD-dependent   : positive group -> role matrix, /me consistency, DN
 *                      leakage, and unreachable-AD (502). These print SKIP
 *     until real credentials are provided in a gitignored `.env.test`.
 *
 * Usage:
 *   node test-ad-login.js
 *   node test-ad-login.js --base-url http://localhost:3001
 *   TEST_BASE_URL=http://localhost:3000 node test-ad-login.js
 *
 * Credentials are read from (gitignored) backend/.env.test; account keys are
 * documented in backend/.env.test.example. NEVER commit real credentials.
 *
 * Security: this script never prints passwords or tokens. It never modifies
 * AD. All maintenance fixtures use a `verify.ad.*` prefix and are removed on
 * completion. The AD-unreachable case runs against an isolated throwaway
 * backend process pointed at a dead LDAP endpoint.
 */

const fs = require("fs");
const path = require("path");
const net = require("net");
const { spawn } = require("child_process");

// Test overrides first (they win); backend/.env then fills the gaps.
require("dotenv").config({ path: path.join(__dirname, ".env.test") });
require("dotenv").config({ path: path.join(__dirname, ".env") });

const jwt = require("jsonwebtoken");

// -----------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--base-url") out.baseUrl = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(
    [
      "Usage: node test-ad-login.js [--base-url http://host:port]",
      "",
      "Accounts are read from a gitignored backend/.env.test",
      "(see backend/.env.test.example). Missing accounts are reported as SKIP.",
    ].join("\n")
  );
  process.exit(0);
}

const BASE = (args.baseUrl || process.env.TEST_BASE_URL || "http://localhost:3000").replace(
  /\/+$/,
  ""
);
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

// -----------------------------------------------------------------------------
// Result collection
// -----------------------------------------------------------------------------
const results = [];
function record(status, name, detail) {
  results.push({ status, name, detail: detail || "" });
  const tag = status.padEnd(4);
  console.log(`  [${tag}] ${name}${detail ? `  \u2014 ${detail}` : ""}`);
}
const pass = (name, detail) => record("PASS", name, detail);
const fail = (name, detail) => record("FAIL", name, detail);
const skip = (name, detail) => record("SKIP", name, detail);
function check(name, cond, detail) {
  if (cond) pass(name, detail);
  else fail(name, detail);
}

function section(title) {
  console.log(`\n${title}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// -----------------------------------------------------------------------------
// HTTP helper (never logs bodies that may contain tokens)
// -----------------------------------------------------------------------------
async function api(method, urlPath, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + urlPath, { method, headers, body: payload });
  const ct = res.headers.get("content-type") || "";
  let json = null;
  let text = null;
  if (ct.includes("application/json")) json = await res.json().catch(() => null);
  else text = await res.text().catch(() => null);
  return { status: res.status, json, text };
}

function sign(payload, expiresIn = "10m", secret = ACCESS_SECRET) {
  return jwt.sign(payload, secret, { expiresIn });
}

function hasNoGroupLeak(obj) {
  const s = JSON.stringify(obj || {});
  return !/memberOf/.test(s) && !/\bCN=/i.test(s) && !/distinguishedName/i.test(s);
}

// -----------------------------------------------------------------------------
// Account configuration
// -----------------------------------------------------------------------------
// Defaults encode the intended AD -> role mapping. Override with
// `<KEY>_EXPECT_*` in .env.test when a test account intentionally differs.
const ACCOUNTS = [
  { key: "IT_EMPLOYEE", n: 1, label: "IT employee (no IT group)", itRole: "EMPLOYEE", itLabel: "Academic", maintRole: "EMPLOYEE" },
  { key: "IT_TECHNICIAN", n: 2, label: "IT technician (IT group)", itRole: "TECHNICIAN", maintRole: "EMPLOYEE" },
  { key: "MAINT_SUPERVISOR", n: 3, label: "Maintenance supervisor", itRole: "EMPLOYEE", maintRole: "SUPERVISOR" },
  { key: "MAINT_WORKER", n: 4, label: "Maintenance worker", itRole: "EMPLOYEE", maintRole: "MAINTENANCE_WORKER" },
  { key: "MAINT_STOREKEEPER", n: 5, label: "Store keeper", itRole: "EMPLOYEE", maintRole: "STORE_KEEPER" },
  { key: "MAINT_ADMIN", n: 6, label: "Maintenance admin (optional)", itRole: "EMPLOYEE", maintRole: "ADMIN" },
  { key: "DUAL", n: 7, label: "Dual-role (IT technician + maint supervisor)", itRole: "TECHNICIAN", maintRole: "SUPERVISOR" },
];

function accountCreds(key) {
  const username = (process.env[`${key}_USERNAME`] || "").trim();
  const password = process.env[`${key}_PASSWORD`] || "";
  return username && password ? { username, password } : null;
}

function accountExpect(key, field, fallback) {
  const raw = (process.env[`${key}_EXPECT_${field}`] || "").trim();
  return raw || fallback;
}

// -----------------------------------------------------------------------------
// Prisma imports + cleanup
// -----------------------------------------------------------------------------
let itPrisma = null;
let mntPrisma = null;
let dbAvailable = false;

function loadPrisma() {
  try {
    const { PrismaClient } = require("@prisma/client");
    const { PrismaClient: MaintPrismaClient } = require("./maintenance/generated/client");
    itPrisma = new PrismaClient();
    mntPrisma = new MaintPrismaClient();
  } catch (err) {
    console.error("Could not load Prisma clients:", err.message);
  }
}

async function cleanup() {
  if (!mntPrisma) return;
  try {
    const users = await mntPrisma.user.findMany({
      where: { username: { startsWith: "verify.ad." } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    if (ids.length === 0) return;

    const reqs = await mntPrisma.maintenanceRequest.findMany({
      where: {
        OR: [{ requesterId: { in: ids } }, { assignedToId: { in: ids } }, { assignedById: { in: ids } }],
      },
      select: { id: true },
    });
    const reqIds = reqs.map((r) => r.id);

    if (reqIds.length > 0) {
      await mntPrisma.notification.deleteMany({ where: { requestId: { in: reqIds } } });
      await mntPrisma.requestSparePart.deleteMany({ where: { requestId: { in: reqIds } } });
      await mntPrisma.requestComment.deleteMany({ where: { requestId: { in: reqIds } } });
      await mntPrisma.requestAssignment.deleteMany({ where: { requestId: { in: reqIds } } });
      await mntPrisma.requestAttachment.deleteMany({ where: { requestId: { in: reqIds } } });
      await mntPrisma.auditLog.deleteMany({ where: { requestId: { in: reqIds } } });
      await mntPrisma.maintenanceRequest.deleteMany({ where: { id: { in: reqIds } } });
    }

    await mntPrisma.requestSparePart.deleteMany({
      where: { OR: [{ requestedById: { in: ids } }, { releasedById: { in: ids } }] },
    });
    await mntPrisma.requestComment.deleteMany({ where: { userId: { in: ids } } });
    await mntPrisma.auditLog.deleteMany({ where: { userId: { in: ids } } });
    await mntPrisma.requestAssignment.deleteMany({
      where: { OR: [{ userId: { in: ids } }, { assignedById: { in: ids } }] },
    });
    await mntPrisma.user.deleteMany({ where: { id: { in: ids } } });
  } catch (err) {
    console.error("cleanup failed:", err.message);
  }
}

async function ensureRole(name) {
  return mntPrisma.role.upsert({
    where: { name },
    update: {},
    create: { name, description: `${name} role` },
  });
}

async function ensureMaintUser(username, roleName) {
  const role = await ensureRole(roleName);
  return mntPrisma.user.upsert({
    where: { username },
    update: { roleId: role.id, isActive: true },
    create: {
      username,
      displayName: username,
      email: `${username}@test.local`,
      roleId: role.id,
      isActive: true,
    },
    include: { role: true },
  });
}

function maintToken(user, roleName) {
  return sign({ userId: user.id, username: user.username, role: roleName });
}

// =============================================================================
// Sections
// -----------------------------------------------------------------------------

async function preflight(state) {
  section("A. Preflight");

  // Backend reachable at all?
  try {
    const r = await api("GET", "/api/health");
    check("backend reachable at base URL", r.status === 200, `${BASE} -> ${r.status}`);
  } catch (err) {
    fail("backend reachable", `cannot reach ${BASE}: ${err.message}`);
    throw new Error("Backend not reachable; start it before running this suite.");
  }

  // AD reachability probe.
  try {
    const r = await api("GET", "/api/auth/ad-status");
    if (r.status === 200 && r.json && typeof r.json.reachable === "boolean") {
      state.adReachable = state.adReachable && r.json.reachable !== false;
      if (state.adReachable) pass("AD reachability probe", "reachable");
      else skip("AD reachability probe", "AD not reachable");
    } else {
      skip("AD reachability probe", `unexpected ${r.status}`);
    }
  } catch (err) {
    skip("AD reachability probe", err.message);
  }

  // DB availability (needed for maintenance RBAC + mixed-case regression).
  if (itPrisma && mntPrisma) {
    try {
      await itPrisma.$queryRaw`SELECT 1`;
      await mntPrisma.$queryRaw`SELECT 1`;
      dbAvailable = true;
      pass("database connectivity", "ticketing + maintenance reachable");
    } catch (err) {
      dbAvailable = false;
      skip("database connectivity", err.message.split("\n")[0]);
    }
  } else {
    skip("database connectivity", "Prisma clients unavailable");
  }

  if (!ACCESS_SECRET) {
    skip("JWT access secret", "JWT_ACCESS_SECRET not set; token-minting tests skipped");
  }
}

// ---- B. auth contract -------------------------------------------------------
async function authContract() {
  section("B. Authentication contract (no AD)");
  {
    const r = await api("POST", "/api/auth/login", { body: {} });
    check("login missing username+password -> 400", r.status === 400, `got ${r.status}`);
  }
  {
    const r = await api("POST", "/api/auth/login", { body: { username: "someone" } });
    check("login missing password -> 400", r.status === 400, `got ${r.status}`);
  }
  {
    const r = await api("POST", "/api/auth/refresh", { body: { refreshToken: "garbage" } });
    check("refresh invalid token -> 401/400", r.status === 401 || r.status === 400, `got ${r.status}`);
  }
  {
    const r = await api("POST", "/api/auth/logout", { body: {} });
    check("logout without token -> 200 (idempotent)", r.status === 200, `got ${r.status}`);
  }
}

// -----------------------------------------------------------------------------
// C. Token handling
// -----------------------------------------------------------------------------
async function tokenHandling() {
  section("C. Access-token handling");
  check("auth /me without token -> 401", (await api("GET", "/api/auth/me")).status === 401);
  check(
    "auth /me with malformed token -> 401",
    (await api("GET", "/api/auth/me", { token: "not-a-real-token" })).status === 401
  );
  check(
    "maintenance with garbage token -> 401",
    (await api("GET", "/api/maintenance/categories", { token: "garbage" })).status === 401
  );

  if (ACCESS_SECRET) {
    const exp = sign({ userId: 1, username: "expired.user", role: "EMPLOYEE" }, "-10s");
    check("expired access token -> 401", (await api("GET", "/api/auth/me", { token: exp })).status === 401);
    const wrong = sign({ userId: 1, username: "x", role: "EMPLOYEE" }, "10m", "definitely-the-wrong-secret-value");
    check("token signed with wrong secret -> 401", (await api("GET", "/api/auth/me", { token: wrong })).status === 401);
  } else {
    skip("expired/wrong-secret token -> 401", "no JWT_ACCESS_SECRET");
  }
}

// -----------------------------------------------------------------------------
// D. Unknown user / wrong password (AD required)
// -----------------------------------------------------------------------------
async function authNegativeAd(state) {
  section("D. AD negative cases (no account enumeration)");
  if (!state.adReachable) {
    skip("unknown user -> 401", "AD not reachable");
    skip("wrong password -> 401", "AD not reachable");
    skip("generic message parity", "AD not reachable");
    return;
  }

  const unknownName = `definitely.unknown.${Date.now()}`;
  const unknown = await api("POST", "/api/auth/login", {
    body: { username: unknownName, password: "not-a-real-password" },
  });
  check("unknown user -> 401", unknown.status === 401, `got ${unknown.status}`);
  const unknownMsg = unknown.json?.error?.message || "";

  const creds = ACCOUNTS.map((a) => accountCreds(a.key)).find(Boolean) || accountCreds("MIXEDCASE");
  if (!creds) {
    skip("wrong password -> 401", "no test account credentials provided");
    skip("generic message parity", "no test account credentials provided");
    return;
  }

  const wrongPw = await api("POST", "/api/auth/login", {
    body: { username: creds.username, password: `${Math.random()}` },
  });
  check("wrong password -> 401", wrongPw.status === 401, `got ${wrongPw.status}`);
  const wrongMsg = wrong.json?.error?.message || "";

  check(
    "unknown-user and wrong-password share the same generic message",
    Boolean(unknownMsg) && unknownMsg === wrongMsg,
    unknownMsg && unknownMsg === unknownMsg ? "" : "messages differ"
  );
}

// -----------------------------------------------------------------------------
// E. IT module RBAC (minted tokens - no DB writes)
// -----------------------------------------------------------------------------
async function itRbac() {
  section("E. IT module RBAC (technician-only routes)");
  if (!ACCESS_SECRET) {
    skip("IT RBAC (minted tokens)", "no JWT_ACCESS_SECRET");
    return;
  }

  const emp = sign({ userId: 900001, username: "rbac.employee", role: "EMPLOYEE" });
  const tech = sign({ userId: 900002, username: "rbac.technician", role: "TECHNICIAN" });

  {
    const r = await api("PATCH", "/api/tickets/1/status", {
      token: emp,
      body: { status: "IN_PROGRESS" },
    });
    check("employee update status (valid body) -> 403", r.status === 403, `got ${r.status}`);
  }
  {
    const r = await api("PATCH", "/api/tickets/1/assign", { token: emp, body: { technicianId: 1 } });
    check("employee assign ticket -> 403", r.status === 403, `got ${r.status}`);
  }
  {
    const r = await api("GET", "/api/users/technicians", { token: emp });
    check("employee list technicians -> 403", r.status === 403, `got ${r.status}`);
  }
  {
    const r = await api("PATCH", "/api/tickets/1/status", { token: sign({ userId: 1, username: "rbac.tech", role: "TECHNICIAN" }), body: {} });
    check("technician update status (empty body) -> 400", r.status === 400, `got ${r.status}`);
  }
  if (dbAvailable) {
    const r = await api("GET", "/api/users/technicians", { token: sign({ userId: 1, username: "rbac.tech", role: "TECHNICIAN" }) });
    check("technician lists technicians -> 200", r.status === 200 && Array.isArray(r.json?.technicians), `got ${r.status}`);
  } else {
    skip("technician lists technicians -> 200", "database unavailable");
  }
}

// -----------------------------------------------------------------------------
// E2. Maintenance RBAC (minted tokens + throwaway users)
// -----------------------------------------------------------------------------
async function maintenanceRbac() {
  section("E2. Maintenance RBAC (role matrix, throwaway data)");
  if (!dbAvailable || !ACCESS_SECRET) {
    skip("maintenance RBAC matrix", !dbAvailable ? "database unavailable" : "no JWT_ACCESS_SECRET");
    return;
  }

  const emp = await ensureMaintUser("verify.ad.emp", "EMPLOYEE");
  const sup = await ensureMaintUser("verify.ad.sup", "SUPERVISOR");
  const worker = await ensureMaintUser("verify.ad.worker", "MAINTENANCE_WORKER");
  const keeper = await ensureMaintUser("verify.ad.keeper", "STORE_KEEPER");
  const admin = await ensureMaintUser("verify.ad.admin", "ADMIN");

  const t = {
    emp: sign({ userId: emp.id, username: emp.username, role: "EMPLOYEE" }),
    sup: sign({ userId: sup.id, username: sup.username, role: "SUPERVISOR" }),
    worker: sign({ userId: worker.id, username: worker.username, role: "MAINTENANCE_WORKER" }),
    keeper: sign({ userId: keeper.id, username: keeper.username, role: "STORE_KEEPER" }),
    admin: sign({ userId: admin.id, username: admin.username, role: "ADMIN" }),
  };

  let category = await mntPrisma.maintenanceCategory.findFirst({ orderBy: { id: "asc" } });
  if (!category) category = await mntPrisma.maintenanceCategory.create({ data: { name: "AD Verify Category" } });

  const created = await api("POST", "/api/maintenance", {
    token: t.emp,
    body: { categoryId: category.id, description: "verify.ad RBAC fixture", location: "Lab", priority: "High" },
  });
  const reqId = created.json?.data?.id;
  check("fixture request created", created.status === 201 && Boolean(reqId), `got ${created.status}`);

  const expect403 = (label, r) => check(`${label} -> 403`, r.status === 403, `got ${r.status}`);
  const expectNot403 = (label, r, status) =>
    check(`${label} -> allowed (not 403)`, r.status !== 403, `got ${r.status}${status ? ` ${status}` : ""}`);

  const workers = "/api/maintenance/workers";
  expect403("workers (employee)", await api("GET", workers, { token: t.emp }));
  expect403("workers (storekeeper)", await api("GET", workers, { token: t.keeper }));
  expect403("workers (worker)", await api("GET", workers, { token: t.worker }));
  check("workers (supervisor) -> 200", (await api("GET", workers, { token: t.sup })).status === 200);
  check("workers (admin) -> 200", (await api("GET", workers, { token: t.admin })).status === 200);

  const assign = `/api/maintenance/${reqId}/assign`;
  expect403("assign (employee)", await api("POST", assign, { token: t.emp, body: { workerId: worker.id } }));
  expect403("assign (worker)", await api("POST", assign, { token: t.worker, body: { workerId: worker.id } }));
  expect403("assign (storekeeper)", await api("POST", assign, { token: t.keeper, body: { workerId: worker.id } }));
  expect403("start-work (employee)", await api("POST", `/api/maintenance/${reqId}/start-work`, { token: t.emp, body: {} }));
  expect403("start-work (keeper)", await api("POST", `/api/maintenance/${reqId}/start-work`, { token: t.keeper, body: {} }));
  expect403("start-work (unassigned worker)", await api("POST", `/api/maintenance/${reqId}/start-work`, { token: t.worker, body: {} }));

  expectNot403("assign (supervisor)", await api("POST", `/api/maintenance/${reqId}/assign`, { token: t.sup, body: { workerId: worker.id } }));
  expectNot403("start-work (assigned worker)", await api("POST", `/api/maintenance/${reqId}/start-work`, { token: t.worker, body: {} }));

  const partCreated = await api("POST", `/api/maintenance/${reqId}/spare-parts`, {
    token: t.worker,
    body: { partName: "verify.ad part", quantity: 1 },
  });
  const partId = partCreated.json?.data?.id;
  check("fixture spare part requested", partCreated.status === 201 && Boolean(partId), `got ${partCreated.status}`);

  expect403("release (employee)", await api("POST", `/api/maintenance/spare-parts/${partId}/release`, { token: t.emp, body: {} }));
  expect403("release (worker)", await api("POST", `/api/maintenance/spare-parts/${partId}/release`, { token: t.worker, body: {} }));
  expectNot403("release (keeper)", await api("POST", `/api/maintenance/spare-parts/${partId}/release`, { token: t.keeper, body: { notes: "verify" } }));

  // ADMIN passes requireRole everywhere it is declared; assert authorization
  // passed (not 403) rather than a specific business status.
  expectNot403("assign (admin)", await api("POST", `/api/maintenance/${reqId}/assign`, { token: t.admin, body: { workerId: worker.id } }));
}

// -----------------------------------------------------------------------------
// F. Username normalization regression (mixed-case)
// -----------------------------------------------------------------------------
async function usernameNormalization(state) {
  section("F. Username normalization (mixed-case identity boundary)");

  if (dbAvailable && ACCESS_SECRET) {
    // Reproduces production semantics: the maintenance row is stored in lower
    // case, while a caller may present mixed casing (e.g. "John.Doe").
    const lower = await ensureMaintUser("verify.ad.mixed", "EMPLOYEE");
    const mixedToken = sign({ userId: lower.id, username: "Verify.Ad.Mixed", role: "EMPLOYEE" });

    const r = await api("GET", "/api/maintenance/categories", { token: mixedToken });
    check(
      "mixed-case token resolves maintenance user -> 200",
      r.status === 200,
      r.status === 401 ? "401 (username not normalized)" : `got ${r.status}`
    );

    const lowerToken = sign({ userId: lower.id, username: "verify.ad.mixed", role: "EMPLOYEE" });
    const r2 = await api("GET", "/api/maintenance/stats", { token: lowerToken });
    check("exact-case token still works (control) -> 200", r2.status === 200, `got ${r2.status}`);
  } else {
    skip("mixed-case token resolves maintenance user", "database/secret unavailable");
  }

  // Full login round-trip when a mixed-case AD account is configured.
  const creds = accountCreds("MIXEDCASE");
  if (!creds) {
    skip("mixed-case AD login -> Maintenance call", "no MIXEDCASE_* credentials");
    return;
  }
  if (!state.adReachable) {
    skip("mixed-case AD login -> Maintenance call", "AD not reachable");
    return;
  }
  const login = await api("POST", "/api/auth/login", { body: creds });
  if (login.status !== 200) {
    check("mixed-case AD login -> 200", false, `got ${login.status}`);
    return;
  }
  pass("mixed-case AD login -> 200");
  const maintenanceCall = await api("GET", "/api/maintenance/categories", { token: login.json.accessToken });
  check("mixed-case login then Maintenance call -> 200", maintenanceCall.status === 200, `got ${maintenanceCall.status}`);
}

// -----------------------------------------------------------------------------
// G. Department mapping regression (canonical names, no duplicates)
// -----------------------------------------------------------------------------
async function departmentMapping() {
  section("G. Department mapping (canonical names)");

  let canonical = null;
  try {
    const seed = require("./maintenance/seed");
    if (Array.isArray(seed.DEFAULT_DEPARTMENTS)) canonical = seed.DEFAULT_DEPARTMENTS;
  } catch (_err) {
    /* handled below */
  }
  if (!canonical) {
    skip("department mapping vs canonical seed", "could not read DEFAULT_DEPARTMENTS from maintenance/seed.js");
    return;
  }

  const raw = (process.env.AD_DEPARTMENT_GROUPS || "").trim();
  if (!raw) {
    skip("department mapping vs canonical seed", "AD_DEPARTMENT_GROUPS not set");
    return;
  }

  const pairs = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const idx = p.indexOf("=");
      return idx === -1 ? null : { group: p.slice(0, idx).trim(), dept: p.slice(idx + 1).trim() };
    })
    .filter(Boolean);

  const offenders = pairs.filter((p) => !canonical.includes(p.dept));
  check(
    "every mapped department matches a seeded canonical name",
    offenders.length === 0,
    offenders.length ? `creates duplicate(s): ${offenders.map((o) => o.dept).join(", ")}` : `${pairs.length} mapping(s) OK`
  );
}

// -----------------------------------------------------------------------------
// H. Positive AD role matrix (requires real credentials)
// -----------------------------------------------------------------------------
async function adRoleMatrix(state) {
  section("H. AD role matrix + /api/auth/me consistency");

  if (!state.adReachable) {
    for (const a of ACCOUNTS) skip(`${a.n}. ${a.label}`, "AD not reachable");
    return;
  }

  for (const a of ACCOUNTS) {
    const creds = accountCreds(a.key);
    if (!creds) {
      skip(`${a.n}. ${a.label}`, `no ${a.key}_* credentials`);
      continue;
    }

    const expectIt = accountExpect(a.key, "IT_ROLE", a.itRole);
    const expectLabel = accountExpect(a.key, "IT_LABEL", a.itLabel);
    const expectMaint = accountExpect(a.key, "MAINT_ROLE", a.maintRole);
    const expectDept = (process.env[`${a.key}_EXPECT_DEPARTMENT`] || "").trim();

    const login = await api("POST", "/api/auth/login", { body: creds });
    if (login.status !== 200) {
      fail(`${a.n}. ${a.label} login`, `got ${login.status}`);
      continue;
    }
    const user = login.json.user || {};
    const maint = user.maintenance || {};

    check(`${a.n}. ${a.label} IT role = ${expectIt}`, user.role === expectIt, `got ${user.role}`);
    if (expectLabel) {
      check(`${a.n}. ${a.label} IT label = ${expectLabel}`, user.roleLabel === expectLabel, `got ${user.roleLabel}`);
    }
    check(`${a.n}. ${a.label} maintenance role = ${expectMaint}`, maint.role === expectMaint, `got ${maint.role}`);
    if (expectDept) {
      check(`${a.n}. ${a.label} department = ${expectDept}`, maint.department === expectDept, `got ${maint.department}`);
    }
    check(`${a.n}. ${a.label} no AD group DN leakage in login response`, hasNoGroupLeak(login.json), "response contained memberOf/CN");

    const maintCall = await api("GET", "/api/maintenance/categories", { token: login.json.accessToken });
    check(`${a.n}. ${a.label} session works on Maintenance API -> 200`, maintCall.status === 200, `got ${maintCall.status}`);

    const me = await api("GET", "/api/auth/me", { token: login.json.accessToken });
    const meUser = me.json?.user || {};
    check(
      `${a.n}. ${a.label} /auth/me roles consistent`,
      me.status === 200 && meUser.role === user.role && (meUser.maintenance || {}).role === maint.role,
      `me=${me.status} role=${meUser.role} maint=${(meUser.maintenance || {}).role}`
    );
    check(`${a.n}. ${a.label} no DN leakage in /auth/me`, hasNoGroupLeak(me.json), "response contained memberOf/CN");
  }
}

// -----------------------------------------------------------------------------
// I. Isolated AD-unreachable -> 502
// -----------------------------------------------------------------------------
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

async function adUnreachable() {
  section("I. Unreachable AD -> 502 (isolated throwaway backend)");

  const tsxCli = path.join(__dirname, "node_modules", "tsx", "dist", "cli.mjs");
  if (!fs.existsSync(tsxCli)) {
    skip("unreachable AD -> 502", "tsx CLI not found");
    return;
  }

  let port;
  try {
    port = await getFreePort();
  } catch (err) {
    skip("unreachable AD -> 502", `could not allocate port: ${err.message}`);
    return;
  }

  const child = spawn(process.execPath, [tsxCli, path.join(__dirname, "src", "server.ts")], {
    cwd: __dirname,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      AD_URL: "ldap://127.0.0.1:9",
      AD_DOMAIN: "unreachable.local",
      AD_BASE_DN: "DC=unreachable,DC=local",
      AD_USER_SEARCH_BASE: "DC=unreachable,DC=local",
      AD_CONNECT_TIMEOUT_MS: "1500",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });

  let childErr = "";
  child.stderr.on("data", (d) => {
    childErr += d.toString();
  });

  try {
    let up = false;
    for (let i = 0; i < 60; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/api/health`);
        if (r.ok) {
          up = true;
          break;
        }
      } catch (_e) {
        /* keep polling */
      }
      await sleep(250);
    }

    if (!up) {
      skip("unreachable AD -> 502", "isolated backend did not start in time");
      return;
    }

    const r = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "probe.user", password: "probe-password" }),
    });
    check("login against unreachable AD -> 502", r.status === 502, `got ${r.status}`);
  } catch (err) {
    skip("unreachable AD -> 502", err.message);
  } finally {
    child.kill();
  }
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
async function main() {
  console.log("==============================================================");
  console.log(" AD authentication & RBAC verification");
  console.log(` Base URL : ${BASE}`);
  console.log(` .env.test: ${fs.existsSync(path.join(__dirname, ".env.test")) ? "loaded" : "not found"}`);
  console.log("==============================================================");

  loadPrisma();

  const state = { adReachable: true };

  try {
    await preflight(state);
    await authContract();
    await tokenHandlingSafe();
    await authNegativeAd(state);
    await itRbac();
    await maintenanceRbac();
    await usernameNormalization(state);
    await departmentMapping();
    await adRoleMatrix(state);
    await adUnreachable();
  } finally {
    await cleanup();
    if (itPrisma) await itPrisma.$disconnect().catch(() => {});
    if (mntPrisma) await mntPrisma.$disconnect().catch(() => {});
  }

  // ---- summary table --------------------------------------------------------
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const skipped = results.filter((r) => r.status === "SKIP").length;

  console.log("\n==============================================================");
  console.log(" Summary");
  console.log("--------------------------------------------------------------");
  const width = results.reduce((w, r) => Math.max(w, r.name.length), 0);
  for (const r of results) {
    console.log(`  ${r.status.padEnd(4)}  ${r.name.padEnd(width)}  ${r.detail}`);
  }
  console.log("--------------------------------------------------------------");
  console.log(`  ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log("==============================================================");

  if (failed > 0) process.exitCode = 1;
}

// Wrapper so a hard failure in one section does not abort the whole suite.
async function tokenHandlingSafe() {
  try {
    await tokenHandling();
  } catch (err) {
    fail("token handling section", err.message);
  }
}

process.on("unhandledRejection", (err) => {
  console.error("\nHARNESS ERROR:", err && err.message ? err.message : err);
  process.exitCode = 1;
});

main().catch(async (err) => {
  console.error("\nHARNESS ERROR:", err && err.message ? err.message : err);
  await cleanup();
  if (itPrisma) await itPrisma.$disconnect().catch(() => {});
  if (mntPrisma) await mntPrisma.$disconnect().catch(() => {});
  process.exitCode = 1;
});
