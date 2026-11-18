const http = require('http');
const { credentials, skipUnlessAvailable } = require('./test-helpers/adCredentials');

async function runPhase3Tests() {
  const port = process.env.PORT || 3001;
  console.log(`\n==============================================`);
  console.log(`Starting Phase 3 Management & Assignments Test`);
  console.log(`Testing server on http://127.0.0.1:${port}`);
  console.log(`==============================================\n`);

  if (skipUnlessAvailable(['EMPLOYEE', 'SUPERVISOR', 'WORKER'], 'Phase 3 — Management & Assignments')) {
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

  try {
    // 1. Employee Login & Request Creation
    console.log('1. Employee Login & Ticket Creation...');
    currentCookie = null;
    const empLogin = await makeRequest({
      method: 'POST',
      path: '/api/auth/login'
    }, credentials.EMPLOYEE);
    assert(empLogin.statusCode === 200, 'Employee login successful');

    const createRes = await makeRequest({
      method: 'POST',
      path: '/api/requests'
    }, {
      categoryId: 1,
      priority: 'High',
      description: 'Phase 3 Test: Classroom 201 Projector Damaged',
      location: 'Building B, Room 201'
    });
    assert(createRes.statusCode === 201, 'Request created with status 201');
    const createdTicket = createRes.body.data;
    assert(createdTicket.status === 'SUBMITTED', 'Initial status is SUBMITTED');
    console.log(`   Created ticket: ${createdTicket.ticketNumber} (ID: ${createdTicket.id})`);

    // 2. Employee RBAC: Cannot list workers
    console.log('\n2. Testing RBAC restrictions on Employee...');
    const empWorkersRes = await makeRequest({
      method: 'GET',
      path: '/api/requests/workers'
    });
    assert(empWorkersRes.statusCode === 403, 'Employee is forbidden from accessing workers list (403)');

    // 3. Employee RBAC: Cannot assign worker
    const empAssignRes = await makeRequest({
      method: 'POST',
      path: `/api/requests/${createdTicket.id}/assign`
    }, { workerId: 3 });
    assert(empAssignRes.statusCode === 403, 'Employee is forbidden from assigning requests (403)');

    // 4. Supervisor Login
    console.log('\n3. Supervisor Login...');
    currentCookie = null;
    const supLogin = await makeRequest({
      method: 'POST',
      path: '/api/auth/login'
    }, credentials.SUPERVISOR);
    assert(supLogin.statusCode === 200, 'Supervisor login successful');
    assert(supLogin.body.data.user.role === 'SUPERVISOR', 'Supervisor role confirmed');

    // 5. Supervisor Stats
    console.log('\n4. Supervisor Stats...');
    const statsRes = await makeRequest({
      method: 'GET',
      path: '/api/requests/stats'
    });
    assert(statsRes.statusCode === 200, 'Supervisor stats retrieved');
    assert(typeof statsRes.body.data.submitted === 'number', 'Submitted count is a number');
    assert(typeof statsRes.body.data.total === 'number', 'Total count is a number');

    // 6. Supervisor List Workers
    console.log('\n5. Supervisor listing assignable workers...');
    const workersRes = await makeRequest({
      method: 'GET',
      path: '/api/requests/workers'
    });
    assert(workersRes.statusCode === 200, 'Workers list retrieved successfully');
    assert(Array.isArray(workersRes.body.data) && workersRes.body.data.length > 0, 'Found at least one worker');
    const targetWorker = workersRes.body.data.find(w => w.username === credentials.WORKER.username.toLowerCase()) || workersRes.body.data[0];
    console.log(`   Selected target worker: ${targetWorker.displayName} (ID: ${targetWorker.id})`);

    // 7. Supervisor Receives Request
    console.log('\n6. Supervisor marking request as received...');
    const receiveRes = await makeRequest({
      method: 'POST',
      path: `/api/requests/${createdTicket.id}/receive`
    });
    assert(receiveRes.statusCode === 200, 'Request marked as received');
    assert(receiveRes.body.data.receivedById !== null, 'receivedById is now recorded');

    // 8. Optimistic Concurrency Control Test
    console.log('\n7. Testing Optimistic Concurrency Control on Assignment...');
    const conflictRes = await makeRequest({
      method: 'POST',
      path: `/api/requests/${createdTicket.id}/assign`
    }, {
      workerId: targetWorker.id,
      expectedCurrentStatus: 'IN_PROGRESS' // Intentional mismatch (current is SUBMITTED)
    });
    assert(conflictRes.statusCode === 409, 'Conflict detected and returned 409 when status mismatched');

    // 9. Supervisor Assigns Worker
    console.log('\n8. Supervisor assigning worker with valid status...');
    const assignRes = await makeRequest({
      method: 'POST',
      path: `/api/requests/${createdTicket.id}/assign`
    }, {
      workerId: targetWorker.id,
      expectedCurrentStatus: 'SUBMITTED'
    });
    assert(assignRes.statusCode === 200, 'Worker assigned successfully');
    assert(assignRes.body.data.status === 'ASSIGNED', 'Request status transitioned to ASSIGNED');
    assert(assignRes.body.data.assignedToId === targetWorker.id, 'assignedToId matches worker');
    assert(assignRes.body.data.assignedById !== null, 'assignedById recorded');
    assert(assignRes.body.data.assignedAt !== null, 'assignedAt timestamp set');
    assert(assignRes.body.data.assignments.length > 0, 'request_assignments record created');

    // 10. Worker Login & Visibility Check
    console.log('\n9. Worker Login & Queue Verification...');
    currentCookie = null;
    const workerLogin = await makeRequest({
      method: 'POST',
      path: '/api/auth/login'
    }, credentials.WORKER);
    assert(workerLogin.statusCode === 200, 'Worker login successful');
    assert(workerLogin.body.data.user.role === 'MAINTENANCE_WORKER', 'Worker role confirmed');

    const workerRequestsRes = await makeRequest({
      method: 'GET',
      path: '/api/requests'
    });
    assert(workerRequestsRes.statusCode === 200, 'Worker requests retrieved');
    const workerTicketIds = workerRequestsRes.body.data.map(r => r.id);
    assert(workerTicketIds.includes(createdTicket.id), 'Assigned ticket is present in worker queue');

    const workerStatsRes = await makeRequest({
      method: 'GET',
      path: '/api/requests/stats'
    });
    assert(workerStatsRes.statusCode === 200, 'Worker stats retrieved');
    assert(workerStatsRes.body.data.assigned >= 1, 'Worker assigned count is >= 1');

    // 11. Worker cannot reject or reassign
    console.log('\n10. Worker RBAC check on management actions...');
    const workerRejectRes = await makeRequest({
      method: 'POST',
      path: `/api/requests/${createdTicket.id}/reject`
    }, { reason: 'Unauthorized' });
    assert(workerRejectRes.statusCode === 403, 'Worker cannot reject requests (403)');

    // 12. Supervisor Reject Request Test
    console.log('\n11. Testing Supervisor Rejection Flow...');
    // Create another ticket as employee to reject
    currentCookie = null;
    await makeRequest({
      method: 'POST',
      path: '/api/auth/login'
    }, credentials.EMPLOYEE);

    const ticketToReject = (await makeRequest({
      method: 'POST',
      path: '/api/requests'
    }, {
      categoryId: 2,
      priority: 'Normal',
      description: 'Phase 3 Rejection Test: Duplicate request',
      location: 'Staff Room'
    })).body.data;

    currentCookie = null;
    await makeRequest({
      method: 'POST',
      path: '/api/auth/login'
    }, credentials.SUPERVISOR);

    const rejectRes = await makeRequest({
      method: 'POST',
      path: `/api/requests/${ticketToReject.id}/reject`
    }, {
      reason: 'Duplicate request already being handled under another ticket.'
    });
    assert(rejectRes.statusCode === 200, 'Supervisor rejected request');
    assert(rejectRes.body.data.status === 'REJECTED', 'Status changed to REJECTED');
    assert(rejectRes.body.data.rejectionReason.includes('Duplicate request'), 'Rejection reason stored');
    assert(rejectRes.body.data.rejectedById !== null, 'rejectedById recorded');

    console.log(`\n==============================================`);
    console.log(`🎉 ALL PHASE 3 TESTS PASSED: ${passedTests}/${totalTests}`);
    console.log(`==============================================\n`);
  } catch (err) {
    console.error('\n❌ Test suite encountered an error:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runPhase3Tests();
