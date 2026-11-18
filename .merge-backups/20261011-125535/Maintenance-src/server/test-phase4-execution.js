const http = require('http');
const { credentials, skipUnlessAvailable } = require('./test-helpers/adCredentials');

async function runPhase4Tests() {
  const port = process.env.PORT || 3001;
  console.log(`\n======================================================`);
  console.log(`Starting Phase 4 Work Execution & Spare Parts Test`);
  console.log(`Testing server on http://127.0.0.1:${port}`);
  console.log(`======================================================\n`);

  if (skipUnlessAvailable(['EMPLOYEE', 'SUPERVISOR', 'WORKER', 'STOREKEEPER'], 'Phase 4 — Work Execution & Spare Parts')) {
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
    // 1. Employee Creates a New Maintenance Request
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
      description: 'Phase 4 Test: Interactive Smartboard flickering and HDMI loose',
      location: 'Science Lab 102'
    });
    assert(createRes.statusCode === 201, 'Request created with status 201');
    const createdTicket = createRes.body.data;
    assert(createdTicket.status === 'SUBMITTED', 'Ticket initial status is SUBMITTED');
    console.log(`   Ticket created: ${createdTicket.ticketNumber} (ID: ${createdTicket.id})`);

    // 2. Supervisor Assigns Worker
    console.log('\n2. Supervisor Assignment...');
    currentCookie = null;
    const supLogin = await makeRequest({
      method: 'POST',
      path: '/api/auth/login'
    }, credentials.SUPERVISOR);
    assert(supLogin.statusCode === 200, 'Supervisor login successful');

    const workersRes = await makeRequest({
      method: 'GET',
      path: '/api/requests/workers'
    });
    const targetWorker = workersRes.body.data.find(w => w.username === credentials.WORKER.username.toLowerCase()) || workersRes.body.data[0];

    const assignRes = await makeRequest({
      method: 'POST',
      path: `/api/requests/${createdTicket.id}/assign`
    }, {
      workerId: targetWorker.id
    });
    assert(assignRes.statusCode === 200, 'Supervisor assigned worker to ticket');
    assert(assignRes.body.data.status === 'ASSIGNED', 'Ticket status transitioned to ASSIGNED');

    // 3. Storekeeper Login & Initial Stats
    console.log('\n3. Storekeeper Role & Stats Verification...');
    currentCookie = null;
    const storeLogin = await makeRequest({
      method: 'POST',
      path: '/api/auth/login'
    }, credentials.STOREKEEPER);
    assert(storeLogin.statusCode === 200, 'Storekeeper login successful');
    assert(storeLogin.body.data.user.role === 'STORE_KEEPER', 'Role is confirmed as STORE_KEEPER');

    const storeStats = await makeRequest({
      method: 'GET',
      path: '/api/requests/stats'
    });
    assert(storeStats.statusCode === 200, 'Storekeeper stats retrieved');
    assert(typeof storeStats.body.data.pendingSpareParts === 'number', 'pendingSpareParts stat is a number');
    assert(typeof storeStats.body.data.releasedSpareParts === 'number', 'releasedSpareParts stat is a number');
    const initialPendingParts = storeStats.body.data.pendingSpareParts;

    // 4. Employee cannot start work or release parts (RBAC)
    console.log('\n4. Testing RBAC restrictions on Work Execution & Spare Parts...');
    currentCookie = null;
    await makeRequest({
      method: 'POST',
      path: '/api/auth/login'
    }, credentials.EMPLOYEE);

    const empStartWork = await makeRequest({
      method: 'POST',
      path: `/api/requests/${createdTicket.id}/start-work`
    });
    assert(empStartWork.statusCode === 403, 'Employee is forbidden from starting work (403)');

    const empReleaseParts = await makeRequest({
      method: 'POST',
      path: `/api/requests/spare-parts/999/release`
    }, { notes: 'Hack' });
    assert(empReleaseParts.statusCode === 403, 'Employee is forbidden from releasing spare parts (403)');

    // 5. Worker Starts Work
    console.log('\n5. Worker Starts Work Flow...');
    currentCookie = null;
    const workerLogin = await makeRequest({
      method: 'POST',
      path: '/api/auth/login'
    }, credentials.WORKER);
    assert(workerLogin.statusCode === 200, 'Worker login successful');

    // Optimistic concurrency conflict test
    const conflictStart = await makeRequest({
      method: 'POST',
      path: `/api/requests/${createdTicket.id}/start-work`
    }, { expectedCurrentStatus: 'SUBMITTED' }); // expected is ASSIGNED, this will mismatch
    assert(conflictStart.statusCode === 409, 'Start work throws 409 when expectedCurrentStatus does not match');

    // Valid start work
    const startWorkRes = await makeRequest({
      method: 'POST',
      path: `/api/requests/${createdTicket.id}/start-work`
    }, { expectedCurrentStatus: 'ASSIGNED' });
    assert(startWorkRes.statusCode === 200, 'Worker successfully started work');
    assert(startWorkRes.body.data.status === 'IN_PROGRESS', 'Status transitioned to IN_PROGRESS');
    assert(startWorkRes.body.data.startedById !== null, 'startedById is recorded');
    assert(startWorkRes.body.data.startedAt !== null, 'startedAt timestamp is recorded');

    // 6. Worker Requests Spare Parts
    console.log('\n6. Spare Parts Request Flow...');
    // Validation: missing partName
    const invalidPartRes1 = await makeRequest({
      method: 'POST',
      path: `/api/requests/${createdTicket.id}/spare-parts`
    }, { partName: '', quantity: 2 });
    assert(invalidPartRes1.statusCode === 400, 'Fails with 400 when partName is empty');

    // Validation: negative quantity
    const invalidPartRes2 = await makeRequest({
      method: 'POST',
      path: `/api/requests/${createdTicket.id}/spare-parts`
    }, { partName: 'HDMI Cable', quantity: -1 });
    assert(invalidPartRes2.statusCode === 400, 'Fails with 400 when quantity is invalid');

    // Valid spare part request
    const partRes = await makeRequest({
      method: 'POST',
      path: `/api/requests/${createdTicket.id}/spare-parts`
    }, {
      partName: 'Gold-Plated HDMI Cable 5m',
      quantity: 1,
      notes: 'Required to replace damaged connector cable'
    });
    assert(partRes.statusCode === 201, 'Spare part requested successfully (201)');
    const createdPart = partRes.body.data;
    assert(createdPart.partName === 'Gold-Plated HDMI Cable 5m', 'Part name saved correctly');
    assert(createdPart.quantity === 1, 'Quantity saved correctly');
    assert(createdPart.releasedAt === null, 'Part initial releasedAt is null');

    // 7. Storekeeper Lists & Releases Spare Parts
    console.log('\n7. Storekeeper Inventory Release Flow...');
    currentCookie = null;
    await makeRequest({
      method: 'POST',
      path: '/api/auth/login'
    }, credentials.STOREKEEPER);

    const listPartsRes = await makeRequest({
      method: 'GET',
      path: `/api/requests/spare-parts?status=PENDING`
    });
    assert(listPartsRes.statusCode === 200, 'Spare parts list retrieved');
    const partInList = listPartsRes.body.data.find(p => p.id === createdPart.id);
    assert(Boolean(partInList), 'Newly requested spare part is visible in Storekeeper pending queue');
    assert(partInList.request?.ticketNumber === createdTicket.ticketNumber, 'Part is linked to correct ticket number');

    // Release the spare part
    const releaseRes = await makeRequest({
      method: 'POST',
      path: `/api/requests/spare-parts/${createdPart.id}/release`
    }, {
      notes: 'Issued from Cabinet B-04'
    });
    assert(releaseRes.statusCode === 200, 'Spare part released successfully');
    assert(releaseRes.body.data.releasedById !== null, 'releasedById is recorded');
    assert(releaseRes.body.data.releasedAt !== null, 'releasedAt timestamp is recorded');

    // Duplicate release attempt fails
    const duplicateRelease = await makeRequest({
      method: 'POST',
      path: `/api/requests/spare-parts/${createdPart.id}/release`
    });
    assert(duplicateRelease.statusCode === 400, 'Releasing already-released spare part returns 400');

    // 8. Worker Completes Maintenance Work
    console.log('\n8. Worker Work Completion Flow...');
    currentCookie = null;
    await makeRequest({
      method: 'POST',
      path: '/api/auth/login'
    }, credentials.WORKER);

    // Validation: missing actionTaken
    const invalidCompRes = await makeRequest({
      method: 'POST',
      path: `/api/requests/${createdTicket.id}/complete`
    }, { actionTaken: '' });
    assert(invalidCompRes.statusCode === 400, 'Fails with 400 when actionTaken is missing');

    // Valid completion
    const completeRes = await makeRequest({
      method: 'POST',
      path: `/api/requests/${createdTicket.id}/complete`
    }, {
      actionTaken: 'Replaced damaged HDMI cable with new 5m cable, securely routed behind wall mount, tested video signal.',
      maintenanceTime: 40,
      finalReport: 'Smartboard projection resolved. Signal stable at 1080p 60Hz. Teacher verified display.',
      expectedCurrentStatus: 'IN_PROGRESS'
    });
    assert(completeRes.statusCode === 200, 'Work completed successfully');
    const completedTicket = completeRes.body.data;
    assert(completedTicket.status === 'COMPLETED', 'Ticket status transitioned to COMPLETED');
    assert(completedTicket.actionTaken.includes('Replaced damaged HDMI cable'), 'Action taken is stored');
    assert(completedTicket.maintenanceTime === 40, 'Maintenance duration (40m) recorded');
    assert(completedTicket.completedById !== null, 'completedById recorded');
    assert(completedTicket.completedAt !== null, 'completedAt timestamp recorded');
    assert(completedTicket.spareParts.length >= 1, 'Spare parts included in completed ticket');

    // Cannot start work again once completed
    const restartAttempt = await makeRequest({
      method: 'POST',
      path: `/api/requests/${createdTicket.id}/start-work`
    });
    assert(restartAttempt.statusCode === 400, 'Cannot start work on completed ticket (400)');

    // 9. Employee Verifies Final Completed Ticket
    console.log('\n9. Requester / Employee Verification...');
    currentCookie = null;
    await makeRequest({
      method: 'POST',
      path: '/api/auth/login'
    }, credentials.EMPLOYEE);

    const empTicketRes = await makeRequest({
      method: 'GET',
      path: `/api/requests/${createdTicket.id}`
    });
    assert(empTicketRes.statusCode === 200, 'Employee retrieved completed ticket details');
    const finalDetail = empTicketRes.body.data;
    assert(finalDetail.status === 'COMPLETED', 'Status is COMPLETED');
    assert(finalDetail.completedBy?.displayName !== null, 'completedBy user details populated');
    assert(finalDetail.spareParts[0].releasedBy?.displayName !== null, 'Spare parts releasedBy user populated');

    // 10. Storekeeper Stats Check
    console.log('\n10. Final Storekeeper Stats Verification...');
    currentCookie = null;
    await makeRequest({
      method: 'POST',
      path: '/api/auth/login'
    }, credentials.STOREKEEPER);

    const finalStoreStats = await makeRequest({
      method: 'GET',
      path: '/api/requests/stats'
    });
    assert(finalStoreStats.statusCode === 200, 'Storekeeper stats retrieved successfully');
    assert(finalStoreStats.body.data.releasedSpareParts >= 1, 'Storekeeper releasedSpareParts counter incremented');

    console.log(`\n======================================================`);
    console.log(`🎉 ALL PHASE 4 TESTS PASSED: ${passedTests}/${totalTests}`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error('\n❌ Phase 4 test suite encountered an error:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runPhase4Tests();
