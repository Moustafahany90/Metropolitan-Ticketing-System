/**
 * Unified regression harness for the merged IT Ticketing + Maintenance platform.
 *
 * Exercises the single JWT-authenticated stack (both modules mounted in one
 * Express app) without requiring real Active Directory credentials:
 *   - Creates throwaway `verify.*` maintenance users directly in the
 *     maintenance DB and mints host-issued access tokens for them.
 *   - Uses existing IT users (read-only) for IT-module authorization checks.
 *   - Removes every row it created on completion.
 *
 * Run against a running dev/prod backend:
 *   node test-unified-regression.js
 *   (optionally: TEST_BASE_URL=http://127.0.0.1:3000)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { PrismaClient: MaintPrismaClient } = require('./maintenance/generated/client');

const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

const itPrisma = new PrismaClient();
const mntPrisma = new MaintPrismaClient();

let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  \u2713 ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  \u2717 ${name}${detail ? ` \u2014 ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

function sign(payload, expiresIn = '10m') {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn });
}

async function api(method, urlPath, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + urlPath, { method, headers, body: payload });
  let json = null;
  let text = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    json = await res.json().catch(() => null);
  } else {
    text = await res.text().catch(() => null);
  }
  return { status: res.status, json, text };
}

async function ensureRole(name) {
  return mntPrisma.role.upsert({
    where: { name },
    update: {},
    create: { name, description: `${name} role` },
  });
}

async function ensureUser(username, roleName) {
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

function tokenFor(user, roleName) {
  return sign({ userId: user.id, username: user.username, role: roleName });
}

async function cleanup() {
  const users = await mntPrisma.user.findMany({
    where: { username: { startsWith: 'verify.' } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;

  const reqs = await mntPrisma.maintenanceRequest.findMany({
    where: {
      OR: [
        { requesterId: { in: ids } },
        { assignedToId: { in: ids } },
        { assignedById: { in: ids } },
      ],
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
}

async function main() {
  console.log('==============================================================');
  console.log(' Unified IT + Maintenance regression');
  console.log(` Base URL: ${BASE}`);
  console.log('==============================================================');

  if (!ACCESS_SECRET) {
    throw new Error('JWT_ACCESS_SECRET is not set (backend/.env missing?)');
  }

  // ---- fixtures -----------------------------------------------------------
  const emp = await ensureUser('verify.emp', 'EMPLOYEE');
  const emp2 = await ensureUser('verify.emp2', 'EMPLOYEE');
  const sup = await ensureUser('verify.sup', 'SUPERVISOR');
  const worker = await ensureUser('verify.worker', 'MAINTENANCE_WORKER');
  const keeper = await ensureUser('verify.keeper', 'STORE_KEEPER');
  const inactive = await ensureUser('verify.inactive', 'EMPLOYEE');
  await mntPrisma.user.update({ where: { id: inactive.id }, data: { isActive: false } });

  const tEmp = tokenFor(emp, 'EMPLOYEE');
  const tEmp2 = tokenFor(emp2, 'EMPLOYEE');
  const tSup = tokenFor(sup, 'SUPERVISOR');
  const tWorker = tokenFor(worker, 'MAINTENANCE_WORKER');
  const tKeeper = tokenFor(keeper, 'STORE_KEEPER');
  const tInactive = tokenFor(inactive, 'EMPLOYEE');

  let category = await mntPrisma.maintenanceCategory.findFirst({ orderBy: { id: 'asc' } });
  if (!category) {
    category = await mntPrisma.maintenanceCategory.create({ data: { name: 'Regression Category' } });
  }

  // ---- A. auth contract (unauthenticated) ---------------------------------
  section('A. Auth contract');
  {
    const r = await api('GET', '/api/maintenance/categories');
    check('maintenance categories without token -> 401', r.status === 401, `got ${r.status}`);
    check(
      'maintenance 401 uses error envelope { error.code, error.message }',
      r.json && r.json.error && typeof r.json.error.code === 'string' && typeof r.json.error.message === 'string',
      JSON.stringify(r.json)
    );
  }
  {
    const r = await api('GET', '/api/maintenance/categories', { token: 'not-a-real-token' });
    check('maintenance categories with garbage token -> 401', r.status === 401, `got ${r.status}`);
  }
  {
    const r = await api('GET', '/api/tickets');
    check('IT tickets without token -> 401', r.status === 401, `got ${r.status}`);
  }
  {
    const r = await api('GET', '/api/auth/me');
    check('auth /me without token -> 401', r.status === 401, `got ${r.status}`);
  }
  {
    const r = await api('POST', '/api/auth/login', { body: {} });
    check('auth login with missing fields -> 400', r.status === 400, `got ${r.status}`);
  }
  {
    const r = await api('POST', '/api/auth/refresh', { body: { refreshToken: 'garbage' } });
    check('auth refresh with invalid token -> 401/400', r.status === 401 || r.status === 400, `got ${r.status}`);
  }
  {
    const r = await api('GET', '/api/definitely-not-a-route');
    check('unknown route -> 404', r.status === 404, `got ${r.status}`);
  }
  {
    const r = await api('GET', '/api/maintenance/categories', { token: tInactive });
    check('deactivated maintenance user -> 403', r.status === 403, `got ${r.status}`);
  }

  // ---- B. maintenance lookups & RBAC --------------------------------------
  section('B. Maintenance lookups & RBAC');
  {
    const r = await api('GET', '/api/maintenance/categories', { token: tEmp });
    check('categories (employee) -> 200 array', r.status === 200 && Array.isArray(r.json?.data), `got ${r.status}`);
  }
  {
    const r = await api('GET', '/api/maintenance/departments', { token: tEmp });
    check('departments (employee) -> 200 array', r.status === 200 && Array.isArray(r.json?.data), `got ${r.status}`);
  }
  {
    const r = await api('GET', '/api/maintenance/workers', { token: tEmp });
    check('workers (employee) -> 403', r.status === 403, `got ${r.status}`);
  }
  {
    const r = await api('GET', '/api/maintenance/workers', { token: tSup });
    check('workers (supervisor) -> 200 array', r.status === 200 && Array.isArray(r.json?.data), `got ${r.status}`);
  }
  {
    const r = await api('GET', '/api/maintenance/stats', { token: tEmp });
    check('stats (employee) -> role EMPLOYEE', r.status === 200 && r.json?.data?.role === 'EMPLOYEE', JSON.stringify(r.json?.data));
  }
  {
    const r = await api('GET', '/api/maintenance/stats', { token: tSup });
    check('stats (supervisor) -> role SUPERVISOR', r.status === 200 && r.json?.data?.role === 'SUPERVISOR', JSON.stringify(r.json?.data));
  }
  {
    const r = await api('GET', '/api/maintenance/attachments/does-not-exist.pdf', { token: tEmp });
    check('missing attachment -> 404', r.status === 404, `got ${r.status}`);
  }

  // ---- C. maintenance workflow --------------------------------------------
  section('C. Maintenance request workflow');
  const created = await api('POST', '/api/maintenance', {
    token: tEmp,
    body: { categoryId: category.id, description: 'Regression: leaking pipe', location: 'Room 101', priority: 'High' },
  });
  check('create request -> 201', created.status === 201, `got ${created.status} ${JSON.stringify(created.json)}`);
  const reqId = created.json?.data?.id;
  check('create returns MNT-XXXXXX ticket number', /^MNT-\d{6}$/.test(created.json?.data?.ticketNumber || ''), created.json?.data?.ticketNumber);
  check('create status SUBMITTED', created.json?.data?.status === 'SUBMITTED', created.json?.data?.status);
  check('create missing description -> 400', (await api('POST', '/api/maintenance', { token: tEmp, body: { categoryId: category.id } })).status === 400);

  {
    const r = await api('GET', `/api/maintenance/${reqId}`, { token: tEmp });
    check('owner can view own request -> 200', r.status === 200 && r.json?.data?.id === reqId, `got ${r.status}`);
  }
  {
    const r = await api('GET', `/api/maintenance/${reqId}`, { token: tEmp2 });
    check('other employee cannot view request -> 403', r.status === 403, `got ${r.status}`);
  }
  {
    const r = await api('GET', '/api/maintenance', { token: tEmp });
    check('list (employee) -> 200 with count', r.status === 200 && typeof r.json?.count === 'number', `got ${r.status}`);
  }
  {
    const r = await api('GET', '/api/maintenance?search=leaking', { token: tSup });
    check('supervisor search finds request', r.status === 200 && r.json?.data?.some((x) => x.id === reqId), `got ${r.status}`);
  }

  {
    const r = await api('POST', `/api/maintenance/${reqId}/assign`, { token: tEmp, body: { workerId: worker.id } });
    check('assign (employee) -> 403', r.status === 403, `got ${r.status}`);
  }
  {
    const r = await api('POST', `/api/maintenance/${reqId}/assign`, { token: tSup, body: { workerId: worker.id } });
    check('assign (supervisor) -> 200 ASSIGNED', r.status === 200 && r.json?.data?.status === 'ASSIGNED', `got ${r.status} ${r.json?.data?.status}`);
  }
  {
    const r = await api('POST', `/api/maintenance/${reqId}/assign`, { token: tSup, body: { workerId: worker.id, expectedCurrentStatus: 'SUBMITTED' } });
    check('stale assign (expected status mismatch) -> 409', r.status === 409, `got ${r.status}`);
  }
  {
    const r = await api('POST', `/api/maintenance/${reqId}/start-work`, { token: tEmp, body: {} });
    check('start-work (employee) -> 403', r.status === 403, `got ${r.status}`);
  }
  {
    const r = await api('POST', `/api/maintenance/${reqId}/start-work`, { token: tWorker, body: {} });
    check('start-work (assigned worker) -> 200 IN_PROGRESS', r.status === 200 && r.json?.data?.status === 'IN_PROGRESS', `got ${r.status} ${r.json?.data?.status}`);
  }

  let partId = null;
  {
    const r = await api('POST', `/api/maintenance/${reqId}/spare-parts`, { token: tWorker, body: { partName: 'Copper elbow', quantity: 2 } });
    partId = r.json?.data?.id;
    check('worker requests spare part -> 201', r.status === 201 && partId, `got ${r.status}`);
  }
  {
    const r = await api('GET', '/api/maintenance/spare-parts?status=PENDING', { token: tKeeper });
    check('storekeeper lists pending spare parts', r.status === 200 && r.json?.data?.some((p) => p.id === partId), `got ${r.status}`);
  }
  {
    const r = await api('POST', `/api/maintenance/spare-parts/${partId}/release`, { token: tKeeper, body: { notes: 'Released at counter' } });
    check('storekeeper releases spare part -> releasedAt set', r.status === 200 && Boolean(r.json?.data?.releasedAt), `got ${r.status}`);
  }
  {
    const r = await api('POST', `/api/maintenance/spare-parts/${partId}/release`, { token: tKeeper, body: {} });
    check('re-releasing released part -> 400', r.status === 400, `got ${r.status}`);
  }
  {
    const r = await api('POST', `/api/maintenance/${reqId}/comments`, { token: tEmp, body: { comment: 'Parts on the way' } });
    check('employee adds comment -> 201', r.status === 201, `got ${r.status}`);
  }
  {
    const r = await api('POST', `/api/maintenance/${reqId}/complete`, { token: tWorker, body: { finalReport: 'no action' } });
    check('complete without actionTaken -> 400', r.status === 400, `got ${r.status}`);
  }
  {
    const r = await api('POST', `/api/maintenance/${reqId}/complete`, { token: tWorker, body: { actionTaken: 'Replaced elbow', maintenanceTime: 30, finalReport: 'Fixed' } });
    check('worker completes request -> 200 COMPLETED', r.status === 200 && r.json?.data?.status === 'COMPLETED', `got ${r.status} ${r.json?.data?.status}`);
  }
  {
    const r = await api('GET', `/api/maintenance/${reqId}`, { token: tSup });
    check('detail shows audit trail + completion fields', r.status === 200 && r.json?.data?.actionTaken === 'Replaced elbow' && (r.json?.data?.auditLogs?.length || 0) > 0, `got ${r.status}`);
  }

  // Rejection path on a fresh request
  {
    const c = await api('POST', '/api/maintenance', { token: tEmp, body: { categoryId: category.id, description: 'Regression: reject me' } });
    const rid = c.json?.data?.id;
    const r = await api('POST', `/api/maintenance/${rid}/reject`, { token: tSup, body: { reason: 'Duplicate request' } });
    check('supervisor rejects request -> 200 REJECTED w/ reason', r.status === 200 && r.json?.data?.status === 'REJECTED' && r.json?.data?.rejectionReason === 'Duplicate request', `got ${r.status}`);
  }

  // ---- D. IT module authorization (existing users, read-only) -------------
  section('D. IT module authorization');
  const itEmp = await itPrisma.user.findFirst({ where: { role: 'EMPLOYEE' } });
  const itTech = await itPrisma.user.findFirst({ where: { role: 'TECHNICIAN' } });
  if (!itEmp || !itTech) {
    console.log('  (skipped: no seeded IT EMPLOYEE/TECHNICIAN users found)');
  } else {
    const tItEmp = sign({ userId: itEmp.id, username: itEmp.username, role: 'EMPLOYEE' });
    const tItTech = sign({ userId: itTech.id, username: itTech.username, role: 'TECHNICIAN' });
    {
      const r = await api('GET', '/api/tickets', { token: tItEmp });
      check('IT list tickets (employee) -> 200', r.status === 200, `got ${r.status}`);
    }
    {
      const r = await api('PATCH', '/api/tickets/1/status', { token: tItEmp, body: { status: 'OPEN' } });
      check('IT update status (employee) -> 403', r.status === 403, `got ${r.status}`);
    }
    {
      const r = await api('PATCH', '/api/tickets/1/status', { token: tItTech, body: {} });
      check('IT update status (technician, empty body) -> 400', r.status === 400, `got ${r.status}`);
    }
    {
      const r = await api('GET', '/api/dashboard', { token: tItTech });
      check('IT dashboard (technician) -> 200', r.status === 200, `got ${r.status}`);
    }
  }

  console.log('\n==============================================================');
  console.log(` Result: ${pass} passed, ${fail} failed`);
  if (failures.length) console.log(` Failed: ${failures.join(' | ')}`);
  console.log('==============================================================');

  return fail;
}

main()
  .catch((err) => {
    console.error('\nHARNESS ERROR:', err);
    fail++;
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    } catch (err) {
      console.error('cleanup failed:', err);
    }
    await itPrisma.$disconnect().catch(() => {});
    await mntPrisma.$disconnect().catch(() => {});
    if (fail > 0) process.exitCode = 1;
  });
