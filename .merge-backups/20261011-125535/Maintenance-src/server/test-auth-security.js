/**
 * Active Directory Authentication Security Test Suite
 * ---------------------------------------------------------------------------
 * Verifies that the application authenticates ONLY against Active Directory and
 * fails closed for every invalid/failure path.
 *
 * The Active Directory server itself is replaced IN-PROCESS by a test double
 * (monkey-patched onto the adService singleton). This is a test-only mechanism
 * for isolated automated tests. It is NOT part of the application and there is
 * no code path in the app that can invoke it — the patched function exists only
 * for the lifetime of this test process.
 *
 * The real-AD integration test (test-ad-integration.js) must be run inside the
 * school network and is separate from this suite.
 */

// Use an isolated port so we do not collide with a running dev server.
process.env.PORT = process.env.TEST_PORT || '3999';
process.env.NODE_ENV = 'test';

// Isolate test data: run against a throwaway copy of the database so this suite
// never writes test users/requests into the real development database.
const path = require('path');
const fs = require('fs');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const sourceDb = path.join(dataDir, 'maintenance.db');
const testDb = path.join(dataDir, 'test-auth-security.db');
try {
  if (fs.existsSync(sourceDb)) fs.copyFileSync(sourceDb, testDb);
} catch (e) {
  console.warn('[TEST] Could not copy source DB for isolation:', e.message);
}
process.env.DATABASE_URL = 'file:../data/test-auth-security.db';

const http = require('http');

const adService = require('./src/services/adService');
const { AdAuthError, AdUnreachableError } = adService;
const { escapeLdapFilter } = adService;

const REAL_AUTH = adService.authenticateUser.bind(adService);

const VALID_USER = {
  username: 'validuser',
  displayName: 'Valid User',
  email: 'validuser@metschool.local',
  adSid: 'S-1-5-21-1111111111-2222222222-3333333333-1001',
  department: 'IT',
  role: 'EMPLOYEE',
  userPrincipalName: 'validuser@metschool.local'
};
const VALID_PASSWORD = 'Correct-Horse-123';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  FAIL: ${message}`);
    throw new Error(`Test assertion failed: ${message}`);
  }
}

function setAdBehavior(behavior) {
  adService.authenticateUser = async (username, password) => {
    const clean = (username || '').trim().toLowerCase();
    switch (behavior) {
      case 'valid':
        if (clean === VALID_USER.username && password === VALID_PASSWORD) {
          return { ...VALID_USER };
        }
        throw new AdAuthError('Invalid username or password.');
      case 'nonexistent':
      case 'wrongpass':
        throw new AdAuthError('Invalid username or password.');
      case 'unreachable':
      case 'searchfail':
        throw new AdUnreachableError('Could not reach Active Directory server.');
      default:
        throw new AdAuthError('Invalid username or password.');
    }
  };
}

async function run() {
  const { app, server } = require('./index.js');
  const port = Number(process.env.PORT);

  console.log(`\n======================================================`);
  console.log(`Active Directory Authentication Security Tests`);
  console.log(`In-process server on http://127.0.0.1:${port}`);
  console.log(`AD backend: TEST DOUBLE (isolated to this process)`);
  console.log(`======================================================\n`);

  let cookie = null;

  function makeRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          headers: {
            'Content-Type': 'application/json',
            ...(cookie ? { Cookie: cookie } : {}),
            ...(options.headers || {})
          },
          ...options
        },
        (res) => {
          let data = '';
          if (res.headers['set-cookie']) {
            cookie = res.headers['set-cookie'].map((c) => c.split(';')[0]).join('; ');
          }
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              resolve({ statusCode: res.statusCode, headers: res.headers, body: data ? JSON.parse(data) : null });
            } catch (e) {
              resolve({ statusCode: res.statusCode, headers: res.headers, raw: data });
            }
          });
        }
      );
      req.on('error', reject);
      if (postData) req.write(JSON.stringify(postData));
      req.end();
    });
  }

  try {
    // -----------------------------------------------------------------
    console.log('1. Configuration: no mock / local auth path exists');
    // -----------------------------------------------------------------
    const authService = require('./src/services/authService');
    assert(typeof authService.isLocalMode === 'undefined', 'authService.isLocalMode() has been removed');
    let ldapServiceExists = true;
    try {
      require('./src/services/ldapService');
    } catch (e) {
      ldapServiceExists = false;
    }
    assert(ldapServiceExists === false, 'insecure ldapService.js duplicate has been deleted');

    const devUsersRes = await makeRequest({ method: 'GET', path: '/api/auth/dev-users' });
    assert(devUsersRes.statusCode === 404, 'GET /api/auth/dev-users returns 404 (endpoint removed)');

    // -----------------------------------------------------------------
    console.log('\n2. LDAP filter injection escaping (RFC 4515)');
    // -----------------------------------------------------------------
    assert(escapeLdapFilter('admin') === 'admin', 'Normal username passes through unchanged');
    const escaped = escapeLdapFilter('*)(objectClass=*');
    assert(!escaped.includes('*') && !escaped.includes('(') && !escaped.includes(')'), 'Wildcard/parens are escaped');
    assert(escapeLdapFilter('a\\b') === 'a\\5cb', 'Backslash is escaped as \\5c');
    assert(escapeLdapFilter('a\0b') === 'a\\00b', 'NUL is escaped as \\00');

    // -----------------------------------------------------------------
    console.log('\n3. Malicious LDAP filter input is rejected');
    // -----------------------------------------------------------------
    setAdBehavior('nonexistent');
    cookie = null;
    const inject = await makeRequest({ method: 'POST', path: '/api/auth/login' }, { username: '*)(objectClass=*', password: 'x' });
    assert(inject.statusCode === 401, 'Injection-style username is rejected with 401');

    // -----------------------------------------------------------------
    console.log('\n4. Empty username / password');
    // -----------------------------------------------------------------
    const emptyBoth = await makeRequest({ method: 'POST', path: '/api/auth/login' }, { username: '', password: '' });
    assert(emptyBoth.statusCode === 400, 'Empty username and password -> 400');
    const emptyUser = await makeRequest({ method: 'POST', path: '/api/auth/login' }, { username: '', password: 'x' });
    assert(emptyUser.statusCode === 400, 'Empty username -> 400');
    const emptyPass = await makeRequest({ method: 'POST', path: '/api/auth/login' }, { username: 'validuser', password: '' });
    assert(emptyPass.statusCode === 400, 'Empty password -> 400');

    // -----------------------------------------------------------------
    console.log('\n5. Nonexistent AD username + any password -> rejected');
    // -----------------------------------------------------------------
    setAdBehavior('nonexistent');
    cookie = null;
    const noUser = await makeRequest({ method: 'POST', path: '/api/auth/login' }, { username: 'ghost.user', password: 'whatever' });
    assert(noUser.statusCode === 401, 'Nonexistent user is rejected with 401');
    assert(!noUser.headers['set-cookie'], 'No session cookie is issued for a rejected login');

    // -----------------------------------------------------------------
    console.log('\n6. Existing AD username + incorrect password -> rejected');
    // -----------------------------------------------------------------
    setAdBehavior('wrongpass');
    cookie = null;
    const badPass = await makeRequest({ method: 'POST', path: '/api/auth/login' }, { username: VALID_USER.username, password: 'wrong-password' });
    assert(badPass.statusCode === 401, 'Incorrect password is rejected with 401');

    // -----------------------------------------------------------------
    console.log('\n7. AD server unavailable / LDAP failure -> fail closed (502)');
    // -----------------------------------------------------------------
    setAdBehavior('unreachable');
    cookie = null;
    const down = await makeRequest({ method: 'POST', path: '/api/auth/login' }, { username: VALID_USER.username, password: VALID_PASSWORD });
    assert(down.statusCode === 502, 'AD unreachable -> 502 (no fallback acceptance)');
    assert(down.body?.error?.code === 'AD_UNREACHABLE', 'Error code is AD_UNREACHABLE');

    setAdBehavior('searchfail');
    cookie = null;
    const searchFail = await makeRequest({ method: 'POST', path: '/api/auth/login' }, { username: VALID_USER.username, password: VALID_PASSWORD });
    assert(searchFail.statusCode === 502, 'LDAP search/connection failure -> 502 (fail closed)');

    // -----------------------------------------------------------------
    console.log('\n8. Protected API without authentication');
    // -----------------------------------------------------------------
    cookie = null;
    const noAuth = await makeRequest({ method: 'GET', path: '/api/requests' });
    assert(noAuth.statusCode === 401, 'GET /api/requests without session -> 401');

    // -----------------------------------------------------------------
    console.log('\n9. Invalid / expired session cookie -> rejected');
    // -----------------------------------------------------------------
    const bogus = await makeRequest(
      { method: 'GET', path: '/api/auth/me', headers: { Cookie: 'connect.sid=s%3Aforged-session-id.invalidsignature' } },
      null
    );
    assert(bogus.statusCode === 401, 'Forged/invalid session cookie -> 401');

    // -----------------------------------------------------------------
    console.log('\n10. Valid AD username + correct password -> success');
    // -----------------------------------------------------------------
    setAdBehavior('valid');
    cookie = null;
    const ok = await makeRequest({ method: 'POST', path: '/api/auth/login' }, { username: VALID_USER.username, password: VALID_PASSWORD });
    assert(ok.statusCode === 200, 'Valid credentials -> 200');
    assert(ok.body?.data?.user?.username === VALID_USER.username, 'Returned user matches');
    assert(ok.body?.data?.user?.role === 'EMPLOYEE', 'Role resolved correctly (EMPLOYEE)');
    assert(Boolean(cookie), 'Session cookie issued on success');

    const me = await makeRequest({ method: 'GET', path: '/api/auth/me' });
    assert(me.statusCode === 200 && me.body?.data?.username === VALID_USER.username, 'Session is valid after login');

    // -----------------------------------------------------------------
    console.log('\n11. Authenticated user can submit a maintenance request (workflow intact)');
    // -----------------------------------------------------------------
    const cats = await makeRequest({ method: 'GET', path: '/api/requests/categories' });
    assert(cats.statusCode === 200 && Array.isArray(cats.body?.data) && cats.body.data.length > 0, 'Categories are available to authenticated user');

    const categoryId = cats.body.data[0].id;
    const createRes = await makeRequest(
      { method: 'POST', path: '/api/requests' },
      { categoryId, priority: 'Normal', description: 'Security test maintenance request', location: 'Test Room' }
    );
    assert(createRes.statusCode === 201, 'Authenticated user can create a request (201)');
    assert(typeof createRes.body?.data?.ticketNumber === 'string', 'Created request has a ticket number');

    console.log(`\n======================================================`);
    console.log(`ALL AUTH SECURITY TESTS PASSED: ${passedTests}/${totalTests}`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error('\nTest suite encountered an error:', err.message);
    process.exitCode = 1;
  } finally {
    adService.authenticateUser = REAL_AUTH;
    server.close();
    process.exit(process.exitCode || 0);
  }
}

run();
