const http = require('http');
const { credentials, skipUnlessAvailable } = require('./test-helpers/adCredentials');

async function runPhase2Tests() {
  // Run on a dedicated port so this suite does not collide with a running dev server.
  process.env.PORT = process.env.PHASE2_TEST_PORT || '3996';
  const { app, server } = require('./index.js');
  const port = (server && server.address() && server.address().port) || process.env.PORT || 3001;
  console.log(`\n========================================`);
  console.log(`Starting Phase 2 Maintenance Requests Test`);
  console.log(`Server running on port ${port}`);
  console.log(`========================================\n`);

  if (skipUnlessAvailable(['EMPLOYEE', 'OTHER', 'SUPERVISOR'], 'Phase 2 — Maintenance Requests')) {
    server.close();
    process.exit(0);
  }

  let currentCookie = null;

  function makeRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
      const headers = {
        'Content-Type': 'application/json',
        ...(currentCookie ? { 'Cookie': currentCookie } : {}),
        ...(options.headers || {})
      };

      const req = http.request({
        hostname: '127.0.0.1',
        port: port,
        headers,
        ...options
      }, (res) => {
        let data = '';
        if (res.headers['set-cookie']) {
          currentCookie = res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
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
    // 1. Login as employee
    console.log('1. Logging in as employee...');
    currentCookie = null;
    const loginRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/login'
    }, credentials.EMPLOYEE);
    if (loginRes.statusCode !== 200) throw new Error('Employee login failed');
    console.log('   Logged in successfully as:', loginRes.body?.data?.user?.username);

    // 2. Fetch categories
    console.log('\n2. Fetching maintenance categories...');
    const categoriesRes = await makeRequest({ method: 'GET', path: '/api/requests/categories' });
    console.log('   Response status:', categoriesRes.statusCode);
    const categories = categoriesRes.body?.data || [];
    console.log(`   Found ${categories.length} categories:`, categories.map(c => c.name));
    if (categoriesRes.statusCode !== 200 || categories.length === 0) {
      throw new Error('Categories fetch failed');
    }
    const testCategory = categories[0];

    // 3. Fetch departments
    console.log('\n3. Fetching departments...');
    const deptsRes = await makeRequest({ method: 'GET', path: '/api/requests/departments' });
    console.log('   Response status:', deptsRes.statusCode);
    const departments = deptsRes.body?.data || [];
    console.log(`   Found ${departments.length} departments`);
    if (deptsRes.statusCode !== 200) throw new Error('Departments fetch failed');

    // 4. Create maintenance request #1
    console.log('\n4. Submitting maintenance request #1...');
    const req1Payload = {
      categoryId: testCategory.id,
      priority: 'High',
      location: 'Building A, Classroom 204',
      description: 'Air conditioning unit is leaking water and the smart board projector won\'t turn on.'
    };
    const createRes1 = await makeRequest({
      method: 'POST',
      path: '/api/requests'
    }, req1Payload);

    console.log('   Response status:', createRes1.statusCode);
    const created1 = createRes1.body?.data;
    console.log('   Created Ticket:', created1?.ticketNumber, '| Status:', created1?.status, '| Priority:', created1?.priority);
    if (createRes1.statusCode !== 201 || !created1?.ticketNumber?.startsWith('MNT-')) {
      throw new Error(`Failed to create request: ${JSON.stringify(createRes1.body)}`);
    }

    // 5. Create maintenance request #2 (verify sequence increment)
    console.log('\n5. Submitting maintenance request #2 to test sequence...');
    const createRes2 = await makeRequest({
      method: 'POST',
      path: '/api/requests'
    }, {
      categoryId: testCategory.id,
      priority: 'Normal',
      location: 'Library 1st floor',
      description: 'Door handle loose and electrical wall outlet dead.'
    });
    const created2 = createRes2.body?.data;
    console.log('   Created Ticket #2:', created2?.ticketNumber);
    if (createRes2.statusCode !== 201 || !created2?.ticketNumber?.startsWith('MNT-')) {
      throw new Error('Failed to create second request');
    }

    const num1 = parseInt(created1.ticketNumber.replace('MNT-', ''), 10);
    const num2 = parseInt(created2.ticketNumber.replace('MNT-', ''), 10);
    if (num2 !== num1 + 1) {
      throw new Error(`Ticket numbers not strictly sequential: ${created1.ticketNumber} -> ${created2.ticketNumber}`);
    }
    console.log(`   Sequential check PASSED: ${created1.ticketNumber} -> ${created2.ticketNumber}`);

    // 6. List requests as employee
    console.log('\n6. Listing requests for employee...');
    const listRes = await makeRequest({ method: 'GET', path: '/api/requests' });
    console.log('   Response status:', listRes.statusCode);
    console.log('   Total requests for employee:', listRes.body?.count);
    if (listRes.statusCode !== 200 || listRes.body?.count < 2) {
      throw new Error('Employee request listing failed');
    }

    // 7. Get single request by ID
    console.log('\n7. Fetching request details by ID...');
    const getRes = await makeRequest({ method: 'GET', path: `/api/requests/${created1.id}` });
    console.log('   Response status:', getRes.statusCode);
    console.log('   Ticket details:', {
      ticketNumber: getRes.body?.data?.ticketNumber,
      requester: getRes.body?.data?.requester?.displayName,
      category: getRes.body?.data?.category?.name
    });
    if (getRes.statusCode !== 200 || getRes.body?.data?.ticketNumber !== created1.ticketNumber) {
      throw new Error('Get request by ID failed');
    }

    // 8. Add a comment
    console.log('\n8. Adding a comment to the ticket...');
    const commentRes = await makeRequest({
      method: 'POST',
      path: `/api/requests/${created1.id}/comments`
    }, { comment: 'Please check before 2 PM while students are out for lunch break.' });
    console.log('   Response status:', commentRes.statusCode);
    console.log('   Added comment:', commentRes.body?.data?.comment);
    if (commentRes.statusCode !== 201 || !commentRes.body?.data?.id) {
      throw new Error('Add comment failed');
    }

    // 9. RBAC Check: Other employee cannot access this ticket
    console.log('\n9. Testing RBAC: other employee trying to access ticket (should return 403)...');
    currentCookie = null;
    await makeRequest({
      method: 'POST',
      path: '/api/auth/login'
    }, credentials.OTHER);
    const rbacRes = await makeRequest({ method: 'GET', path: `/api/requests/${created1.id}` });
    console.log('   Response status:', rbacRes.statusCode, '(Expected 403)');
    if (rbacRes.statusCode !== 403) {
      throw new Error('RBAC violation: other employee should not access this request');
    }

    // 10. Supervisor can view all requests
    console.log('\n10. Testing Supervisor access to all requests...');
    currentCookie = null;
    await makeRequest({
      method: 'POST',
      path: '/api/auth/login'
    }, credentials.SUPERVISOR);
    const supervisorRes = await makeRequest({ method: 'GET', path: `/api/requests/${created1.id}` });
    console.log('   Supervisor view ticket status:', supervisorRes.statusCode);
    if (supervisorRes.statusCode !== 200) {
      throw new Error('Supervisor should be able to view any request');
    }

    console.log('\n========================================');
    console.log('ALL PHASE 2 BACKEND REQUEST TESTS PASSED!');
    console.log('========================================\n');
  } catch (err) {
    console.error('\nTest failed with error:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    process.exit(process.exitCode || 0);
  }
}

runPhase2Tests();
