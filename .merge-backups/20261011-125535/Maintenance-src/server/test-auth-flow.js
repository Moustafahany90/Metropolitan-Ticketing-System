const http = require('http');
const { credentials, skipUnlessAvailable } = require('./test-helpers/adCredentials');

async function runTests() {
  // Run on a dedicated port so this suite does not collide with a running dev server.
  process.env.PORT = process.env.PHASE1_TEST_PORT || '3997';
  // Start the server directly or import app
  const { app, server } = require('./index.js');
  const port = (server && server.address() && server.address().port) || process.env.PORT || 3001;
  console.log(`\n========================================`);
  console.log(`Starting Phase 1 Authentication Flow Test`);
  console.log(`Server running on port ${port}`);
  console.log(`========================================\n`);

  if (skipUnlessAvailable(['EMPLOYEE', 'SUPERVISOR', 'WORKER'], 'Phase 1 — Authentication Flow')) {
    server.close();
    process.exit(0);
  }

  let cookie = null;

  function makeRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: port,
        headers: {
          'Content-Type': 'application/json',
          ...(cookie ? { 'Cookie': cookie } : {}),
          ...(options.headers || {})
        },
        ...options
      }, (res) => {
        let data = '';
        if (res.headers['set-cookie']) {
          cookie = res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
        }
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: data ? JSON.parse(data) : null
            });
          } catch (e) {
            resolve({ statusCode: res.statusCode, headers: res.headers, raw: data });
          }
        });
      });

      req.on('error', reject);
      if (postData) {
        req.write(JSON.stringify(postData));
      }
      req.end();
    });
  }

  try {
    // 1. Health check
    console.log('1. Testing /health endpoint...');
    const health = await makeRequest({ method: 'GET', path: '/health' });
    console.log('   Response status:', health.statusCode);
    console.log('   Status:', health.body?.status);
    if (health.statusCode !== 200) throw new Error('Health check failed');

    // 2. Unauthenticated /api/auth/me
    console.log('\n2. Testing unauthenticated /api/auth/me (should fail with 401)...');
    const unauth = await makeRequest({ method: 'GET', path: '/api/auth/me' });
    console.log('   Response status:', unauth.statusCode);
    console.log('   Error Code:', unauth.body?.error?.code);
    if (unauth.statusCode !== 401) throw new Error('Unauthenticated check should be 401');

    // 3. Login as employee
    console.log('\n3. Testing login as employee (role: EMPLOYEE)...');
    const loginEmp = await makeRequest({
      method: 'POST',
      path: '/api/auth/login'
    }, credentials.EMPLOYEE);
    console.log('   Response status:', loginEmp.statusCode);
    console.log('   Logged in user:', loginEmp.body?.data?.user);
    if (loginEmp.statusCode !== 200 || loginEmp.body?.data?.user?.role !== 'EMPLOYEE') {
      throw new Error('Employee login failed');
    }

    // 4. Test /api/auth/me with session
    console.log('\n4. Testing /api/auth/me with active session...');
    const me = await makeRequest({ method: 'GET', path: '/api/auth/me' });
    console.log('   Response status:', me.statusCode);
    console.log('   Current user:', me.body?.data);
    if (me.statusCode !== 200 || me.body?.data?.username !== 'employee') {
      throw new Error('Session me check failed');
    }

    // 5. Test logout
    console.log('\n5. Testing logout...');
    const logout = await makeRequest({ method: 'POST', path: '/api/auth/logout' });
    console.log('   Response status:', logout.statusCode);
    console.log('   Message:', logout.body?.message);

    // 6. Test /api/auth/me after logout
    console.log('\n6. Testing /api/auth/me after logout (should fail with 401)...');
    const meAfterLogout = await makeRequest({ method: 'GET', path: '/api/auth/me' });
    console.log('   Response status:', meAfterLogout.statusCode);
    if (meAfterLogout.statusCode !== 401) throw new Error('Post-logout me check should be 401');

    // 7. Test login as supervisor
    console.log('\n7. Testing login as supervisor (role: SUPERVISOR)...');
    cookie = null;
    const loginSup = await makeRequest({
      method: 'POST',
      path: '/api/auth/login'
    }, credentials.SUPERVISOR);
    console.log('   Response status:', loginSup.statusCode);
    console.log('   Supervisor user:', loginSup.body?.data?.user);
    if (loginSup.statusCode !== 200 || loginSup.body?.data?.user?.role !== 'SUPERVISOR') {
      throw new Error('Supervisor login failed');
    }

    // 8. Test login as maintenance worker
    console.log('\n8. Testing login as worker (role: MAINTENANCE_WORKER)...');
    cookie = null;
    const loginWorker = await makeRequest({
      method: 'POST',
      path: '/api/auth/login'
    }, credentials.WORKER);
    console.log('   Response status:', loginWorker.statusCode);
    console.log('   Worker user:', loginWorker.body?.data?.user);
    if (loginWorker.statusCode !== 200 || loginWorker.body?.data?.user?.role !== 'MAINTENANCE_WORKER') {
      throw new Error('Worker login failed');
    }

    console.log('\n========================================');
    console.log('ALL PHASE 1 AUTHENTICATION TESTS PASSED!');
    console.log('========================================\n');
  } catch (err) {
    console.error('\nTest failed with error:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    process.exit(process.exitCode || 0);
  }
}

runTests();
