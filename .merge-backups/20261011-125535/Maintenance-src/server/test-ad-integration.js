const http = require('http');
const adService = require('./src/services/adService');
const { AdUnreachableError, AdAuthError, formatSid } = require('./src/services/adService');

async function runAdIntegrationTests() {
  const port = process.env.PORT || 3001;
  console.log(`\n======================================================`);
  console.log(`Starting Active Directory Integration Test Suite`);
  console.log(`Testing server on http://127.0.0.1:${port}`);
  console.log(`======================================================\n`);

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      throw new Error(`Test assertion failed: ${message}`);
    }
  }

  let currentCookie = null;

  function makeRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
      const headers = {
        'Content-Type': 'application/json',
        ...(currentCookie ? { Cookie: currentCookie } : {}),
        ...(options.headers || {})
      };

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: port,
          headers,
          ...options
        },
        (res) => {
          let data = '';
          if (res.headers['set-cookie']) {
            currentCookie = res.headers['set-cookie'].map((c) => c.split(';')[0]).join('; ');
          }
          res.on('data', (chunk) => (data += chunk));
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
        }
      );

      req.on('error', reject);
      if (postData) {
        req.write(JSON.stringify(postData));
      }
      req.end();
    });
  }

  try {
    // -----------------------------------------------------------------
    // 1. Binary objectSid parser unit tests
    // -----------------------------------------------------------------
    console.log('1. Testing Binary objectSid to String Formatter...');
    // Simulated Active Directory SID buffer for S-1-5-21-3623811015-3361044348-30300820-1013
    // Revision = 1, SubAuthorityCount = 5, Authority = 5 (0x000000000005)
    // SubAuthorities: 21, 3623811015, 3361044348, 30300820, 1013
    const sidBuffer = Buffer.alloc(28);
    sidBuffer.writeUInt8(1, 0); // Revision
    sidBuffer.writeUInt8(5, 1); // SubAuthorityCount
    sidBuffer.writeUIntBE(5, 2, 6); // Authority = 5
    sidBuffer.writeUInt32LE(21, 8); // SubAuth 1 = 21
    sidBuffer.writeUInt32LE(3623811015, 12); // SubAuth 2
    sidBuffer.writeUInt32LE(3361044348, 16); // SubAuth 3
    sidBuffer.writeUInt32LE(30300820, 20); // SubAuth 4
    sidBuffer.writeUInt32LE(1013, 24); // SubAuth 5

    const parsedSid = formatSid(sidBuffer);
    assert(parsedSid === 'S-1-5-21-3623811015-3361044348-30300820-1013', 'Binary SID buffer formatted accurately to S-1-5-21-...');
    assert(formatSid(null) === null, 'formatSid(null) safely returns null');
    assert(formatSid(Buffer.alloc(4)) === null, 'formatSid with truncated buffer safely returns null');

    // -----------------------------------------------------------------
    // 2. Role Resolution logic from AD memberOf
    // -----------------------------------------------------------------
    console.log('\n2. Testing AD Group CN Role Resolution...');
    // Admin group
    const adminRole = adService.resolveRole(['CN=Domain Admins,OU=Groups,DC=metschool,DC=local']);
    assert(adminRole === 'ADMIN', 'Domain Admins maps to ADMIN role');

    // Supervisor group (case-insensitive test)
    const supRole = adService.resolveRole(['cn=maintenance supervisors,ou=groups,dc=metschool,dc=local']);
    assert(supRole === 'SUPERVISOR', 'Maintenance Supervisors maps case-insensitively to SUPERVISOR');

    // Worker group
    const workerRole = adService.resolveRole(['CN=Maintenance Workers,OU=Groups,DC=metschool,DC=local']);
    assert(workerRole === 'MAINTENANCE_WORKER', 'Maintenance Workers maps to MAINTENANCE_WORKER');

    // Storekeeper group
    const storeRole = adService.resolveRole(['CN=Store Keepers,OU=Groups,DC=metschool,DC=local']);
    assert(storeRole === 'STORE_KEEPER', 'Store Keepers maps to STORE_KEEPER');

    // Fallback employee
    const defaultRole = adService.resolveRole(['CN=Teachers,OU=Staff,DC=metschool,DC=local']);
    assert(defaultRole === 'EMPLOYEE', 'Standard staff groups fall back safely to EMPLOYEE role');

    // -----------------------------------------------------------------
    // 3. Department Resolution logic
    // -----------------------------------------------------------------
    console.log('\n3. Testing AD Department Attribute & Fallback Mapping...');
    const directDept = adService.resolveDepartment('Facilities & Maintenance', []);
    assert(directDept === 'Facilities & Maintenance', 'Direct AD department attribute is honored');

    const mappedDept = adService.resolveDepartment(null, ['CN=Elementary Teachers,OU=Staff,DC=metschool,DC=local']);
    assert(mappedDept === 'Elementary Education', 'Fallback group mapping resolves to Elementary Education');

    // -----------------------------------------------------------------
    // 4. AD Server Reachability Probe
    // -----------------------------------------------------------------
    console.log('\n4. Testing AD Reachability Probe...');
    const probe = await adService.checkAdReachability();
    assert(typeof probe.reachable === 'boolean', 'Reachability probe returns a boolean');
    assert(typeof probe.latencyMs === 'number', 'Latency measurement is a number');
    assert(Boolean(probe.adUrl), 'Probe returns configured AD URL');

    // -----------------------------------------------------------------
    // 5. API Endpoint: GET /api/auth/ad-status
    // -----------------------------------------------------------------
    console.log('\n5. Testing API Endpoint: GET /api/auth/ad-status...');
    const statusRes = await makeRequest({
      method: 'GET',
      path: '/api/auth/ad-status'
    });
    assert(statusRes.statusCode === 200, 'GET /api/auth/ad-status returned 200');
    assert(statusRes.body?.success === true, 'Response contains success: true');
    assert(typeof statusRes.body?.data?.reachable === 'boolean', 'Response contains data.reachable');
    assert(Boolean(statusRes.body?.data?.authMode), `Response contains authMode: ${statusRes.body?.data?.authMode}`);

    // -----------------------------------------------------------------
    // 6. Login Validation & Error Responses
    // -----------------------------------------------------------------
    console.log('\n6. Testing Login Endpoint Validation...');
    // Empty credentials
    const emptyLogin = await makeRequest(
      {
        method: 'POST',
        path: '/api/auth/login'
      },
      { username: '', password: '' }
    );
    assert(emptyLogin.statusCode === 400, 'Empty credentials returns 400 Bad Request');
    assert(emptyLogin.body?.error?.code === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');

    // -----------------------------------------------------------------
    // 7. Successful Authentication & User Sync with adSid (REAL AD)
    //    Requires real school AD credentials (never hardcoded):
    //      AD_TEST_USERNAME=<sAMAccountName> AD_TEST_PASSWORD=<password>
    // -----------------------------------------------------------------
    console.log('\n7. Testing Successful Authentication & adSid Persistence (REAL AD)...');
    const testUser = process.env.AD_TEST_USERNAME;
    const testPass = process.env.AD_TEST_PASSWORD;
    if (!testUser || !testPass) {
      console.log('  SKIPPED: set AD_TEST_USERNAME and AD_TEST_PASSWORD to run the real-AD success test.');
    } else {
      currentCookie = null;
      const loginRes = await makeRequest(
        {
          method: 'POST',
          path: '/api/auth/login'
        },
        { username: testUser, password: testPass }
      );
      assert(loginRes.statusCode === 200, 'Valid AD user login returned 200');
      assert(loginRes.body?.data?.user?.username === testUser.toLowerCase(), 'User username matches');

      // Verify session
      const meRes = await makeRequest({
        method: 'GET',
        path: '/api/auth/me'
      });
      assert(meRes.statusCode === 200, 'GET /api/auth/me returns 200 with valid session');
      assert(meRes.body?.data?.username === testUser.toLowerCase(), 'Session correctly identifies user');
    }

    // -----------------------------------------------------------------
    // 7b. Live rejection against the REAL AD server
    // -----------------------------------------------------------------
    console.log('\n7b. Testing live rejection against REAL AD...');
    currentCookie = null;
    const ghostRes = await makeRequest(
      { method: 'POST', path: '/api/auth/login' },
      { username: `nonexistent.${Date.now()}`, password: 'irrelevant-password' }
    );
    assert(ghostRes.statusCode === 401, 'Nonexistent AD user is rejected with 401 (live)');
    assert(!ghostRes.headers['set-cookie'], 'No session cookie issued for rejected live login');

    // -----------------------------------------------------------------
    // 8. Error Mapping: AdUnreachableError -> 502 Bad Gateway
    // -----------------------------------------------------------------
    console.log('\n8. Testing Error Classification: 502 AD_UNREACHABLE on Down DC...');
    const unreachableErr = new AdUnreachableError('Active Directory DC ADD-DC.metschool.local is unreachable');
    assert(unreachableErr.status === 502, 'AdUnreachableError has status 502');
    assert(unreachableErr.code === 'AD_UNREACHABLE', 'AdUnreachableError has code AD_UNREACHABLE');

    const authErr = new AdAuthError('Invalid credentials');
    assert(authErr.status === 401, 'AdAuthError has status 401');
    assert(authErr.code === 'INVALID_CREDENTIALS', 'AdAuthError has code INVALID_CREDENTIALS');

    console.log(`\n======================================================`);
    console.log(`🎉 ALL ACTIVE DIRECTORY INTEGRATION TESTS PASSED: ${passedTests}/${totalTests}`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error('\n❌ Test suite encountered an error:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runAdIntegrationTests();
