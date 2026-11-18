/**
 * Real Active Directory test credentials helper.
 *
 * The phase test suites authenticate against the REAL school AD. Credentials
 * are supplied per role via environment variables (never hardcoded):
 *
 *   TEST_AD_EMPLOYEE_USER / TEST_AD_EMPLOYEE_PASS
 *   TEST_AD_SUPERVISOR_USER / TEST_AD_SUPERVISOR_PASS
 *   TEST_AD_WORKER_USER / TEST_AD_WORKER_PASS
 *   TEST_AD_STOREKEEPER_USER / TEST_AD_STOREKEEPER_PASS
 *   TEST_AD_ADMIN_USER / TEST_AD_ADMIN_PASS
 *   TEST_AD_OTHER_USER / TEST_AD_OTHER_PASS   (a second, different employee for RBAC checks)
 *
 * If a required role is missing the suite prints what to set and skips.
 */

const ROLES = ['EMPLOYEE', 'SUPERVISOR', 'WORKER', 'STOREKEEPER', 'ADMIN', 'OTHER'];

function envName(role, suffix) {
  return `TEST_AD_${role}_${suffix}`;
}

function read(role) {
  return {
    username: process.env[envName(role, 'USER')] || null,
    password: process.env[envName(role, 'PASS')] || null
  };
}

const credentials = {};
for (const role of ROLES) {
  credentials[role] = read(role);
}

function missingRoles(roles) {
  return roles.filter((role) => !credentials[role]?.username || !credentials[role]?.password);
}

function skipUnlessAvailable(roles, label) {
  const missing = missingRoles(roles);
  if (missing.length) {
    console.log('\n========================================');
    console.log(`SKIPPED: ${label}`);
    console.log(`Requires real Active Directory test accounts for: ${missing.join(', ')}`);
    console.log('Set the following environment variables (PowerShell) and re-run:');
    for (const role of missing) {
      console.log(`  $env:${envName(role, 'USER')}="<sAMAccountName>"; $env:${envName(role, 'PASS')}="<password>"`);
    }
    console.log('========================================\n');
    return true;
  }
  return false;
}

module.exports = { ROLES, credentials, missingRoles, skipUnlessAvailable };
