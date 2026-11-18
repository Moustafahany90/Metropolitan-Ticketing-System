const { Client } = require('ldapts');
const net = require('net');
require('dotenv').config();

class AdUnreachableError extends Error {
  constructor(message = 'Could not reach Active Directory server.') {
    super(message);
    this.name = 'AdUnreachableError';
    this.status = 502;
    this.code = 'AD_UNREACHABLE';
  }
}

class AdAuthError extends Error {
  constructor(message = 'Invalid username or password.') {
    super(message);
    this.name = 'AdAuthError';
    this.status = 401;
    this.code = 'INVALID_CREDENTIALS';
  }
}

/**
 * Converts Active Directory binary objectSid buffer to standard string representation
 * Example: S-1-5-21-3623811015-3361044348-30300820-1013
 * @param {Buffer} buffer
 * @returns {string|null}
 */
function formatSid(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 8) {
    return null;
  }
  try {
    const revision = buffer.readUInt8(0);
    const subAuthorityCount = buffer.readUInt8(1);
    const authority = buffer.readUIntBE(2, 6);
    let sid = `S-${revision}-${authority}`;
    for (let i = 0; i < subAuthorityCount; i++) {
      const subAuth = buffer.readUInt32LE(8 + i * 4);
      sid += `-${subAuth}`;
    }
    return sid;
  } catch (err) {
    console.error('[AD] Error parsing objectSid buffer:', err);
    return null;
  }
}

/**
 * Parses CN from DN string: CN=GroupName,OU=Groups,DC=metschool,DC=local -> GroupName
 * @param {string} dn
 * @returns {string}
 */
function extractCn(dn) {
  if (!dn || typeof dn !== 'string') return '';
  const match = dn.match(/^CN=([^,]+)/i);
  return match ? match[1].trim() : dn.trim();
}

/**
 * Normalizes an LDAP attribute value to a single trimmed string.
 * ldapts returns multi-valued attributes (e.g. `department`, `memberOf`) as arrays
 * and single-valued attributes as strings, so callers must not assume a type.
 * @param {string|string[]|Buffer|undefined|null} value
 * @returns {string}
 */
function firstString(value) {
  if (Array.isArray(value)) {
    const first = value.find((v) => v !== undefined && v !== null && v !== '');
    return first === undefined ? '' : String(first).trim();
  }
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

/**
 * Escapes a value for safe inclusion in an LDAP search filter per RFC 4515.
 * Prevents LDAP injection (e.g. `admin)(objectClass=*`).
 * @param {string} value
 * @returns {string}
 */
function escapeLdapFilter(value) {
  return String(value).replace(/[\0()*\\]/g, (char) => {
    return `\\${char.charCodeAt(0).toString(16).padStart(2, '0')}`;
  });
}

/**
 * Resolves LDAP/TLS connection settings from environment.
 * Never silently downgrades: if TLS is requested it must succeed.
 * @returns {{ url: string, startTls: boolean, tlsOptions: object }}
 */
function resolveConnectionSettings() {
  const url = process.env.AD_URL || 'ldap://ADD-DC.metschool.local';
  const startTls = (process.env.AD_STARTTLS || '').toLowerCase() === 'true';

  const tlsOptions = {};
  if ((process.env.AD_TLS_REJECT_UNAUTHORIZED || '').toLowerCase() === 'false') {
    // Explicit opt-in only (e.g. school DC using a self-signed certificate).
    tlsOptions.rejectUnauthorized = false;
    console.warn('[AD] TLS certificate validation is DISABLED (AD_TLS_REJECT_UNAUTHORIZED=false).');
  }

  return { url, startTls, tlsOptions };
}

class ADService {
  /**
   * Determine user role from AD memberOf groups
   * Matches against comma-separated CN lists in env:
   * - AD_ADMIN_GROUPS -> ADMIN
   * - AD_SUPERVISOR_GROUPS -> SUPERVISOR
   * - AD_WORKER_GROUPS -> MAINTENANCE_WORKER
   * - AD_STOREKEEPER_GROUPS -> STORE_KEEPER
   * - Default -> EMPLOYEE
   * @param {Array<string>|string} memberOf
   * @returns {string} One of the 5 application roles
   */
  resolveRole(memberOf) {
    const rawGroups = Array.isArray(memberOf) ? memberOf : (memberOf ? [memberOf] : []);
    const groupCns = rawGroups.map(extractCn).filter(Boolean);

    const parseEnvList = (envVal) =>
      (envVal || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

    const adminGroups = parseEnvList(process.env.AD_ADMIN_GROUPS || 'Domain Admins,IT Administrators');
    const supervisorGroups = parseEnvList(process.env.AD_SUPERVISOR_GROUPS || 'Maintenance Supervisors,Facilities Management');
    const workerGroups = parseEnvList(process.env.AD_WORKER_GROUPS || 'Maintenance Technicians,Maintenance Workers');
    const storekeeperGroups = parseEnvList(process.env.AD_STOREKEEPER_GROUPS || 'Store Keepers,Inventory Staff');

    const lowerGroupCns = groupCns.map((g) => g.toLowerCase());

    if (process.env.LOG_LEVEL === 'debug') {
      console.log('[ad-groups] User memberOf CNs:', groupCns);
    }

    // Role priority resolution
    if (lowerGroupCns.some((cn) => adminGroups.includes(cn))) {
      return 'ADMIN';
    }
    if (lowerGroupCns.some((cn) => supervisorGroups.includes(cn))) {
      return 'SUPERVISOR';
    }
    if (lowerGroupCns.some((cn) => workerGroups.includes(cn))) {
      return 'MAINTENANCE_WORKER';
    }
    if (lowerGroupCns.some((cn) => storekeeperGroups.includes(cn))) {
      return 'STORE_KEEPER';
    }

    return 'EMPLOYEE';
  }

  /**
   * Resolve department name from AD department attribute or group mappings
   * @param {string|null} directDepartment
   * @param {Array<string>|string} memberOf
   * @returns {string|null}
   */
  resolveDepartment(directDepartment, memberOf) {
    const direct = firstString(directDepartment);
    if (direct) {
      return direct;
    }

    const mappingStr = process.env.AD_DEPARTMENT_GROUPS || '';
    if (!mappingStr) return null;

    const rawGroups = Array.isArray(memberOf) ? memberOf : (memberOf ? [memberOf] : []);
    const groupCns = rawGroups.map(extractCn).filter(Boolean).map((g) => g.toLowerCase());

    // Format: GroupCN=DeptName,GroupCN2=DeptName2
    const pairs = mappingStr.split(',').map((p) => p.trim());
    for (const pair of pairs) {
      const [cn, dept] = pair.split('=').map((s) => s.trim());
      if (cn && dept && groupCns.includes(cn.toLowerCase())) {
        return dept;
      }
    }

    return null;
  }

  /**
   * Check TCP / LDAP reachability to Active Directory domain controller
   * @returns {Promise<{ reachable: boolean, adUrl: string, latencyMs: number, error?: string }>}
   */
  async checkAdReachability() {
    const adUrl = process.env.AD_URL || 'ldap://ADD-DC.metschool.local';
    let host = 'ADD-DC.metschool.local';
    let port = 389;
    try {
      const parsed = new URL(adUrl);
      host = parsed.hostname || host;
      port = parseInt(parsed.port, 10) || (parsed.protocol === 'ldaps:' ? 636 : 389);
    } catch (_) {
      // Fallback defaults if malformed URL
    }
    const timeout = parseInt(process.env.AD_CONNECT_TIMEOUT_MS, 10) || 3000;

    const start = Date.now();
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeout);

      socket.on('connect', () => {
        const latencyMs = Date.now() - start;
        socket.destroy();
        resolve({
          reachable: true,
          adUrl,
          latencyMs
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({
          reachable: false,
          adUrl,
          latencyMs: Date.now() - start,
          error: `Connection timed out after ${timeout}ms`
        });
      });

      socket.on('error', (err) => {
        socket.destroy();
        resolve({
          reachable: false,
          adUrl,
          latencyMs: Date.now() - start,
          error: err.message
        });
      });

      socket.connect(port, host);
    });
  }

  /**
   * Authenticate user against Active Directory using UPN direct-bind
   * Throws AdUnreachableError (502) if DC is unreachable/timeout/DNS fails.
   * Throws AdAuthError (401) if credentials are invalid.
   * @param {string} username - sAMAccountName
   * @param {string} password - User password
   * @returns {Promise<Object>}
   */
  async authenticateUser(username, password) {
    const cleanUsername = (username || '').trim();
    if (!cleanUsername || !password) {
      throw new AdAuthError('Username and password are required.');
    }

    const domain = process.env.AD_DOMAIN || 'metschool.local';
    const upn = cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@${domain}`;
    const sAMAccountName = cleanUsername.split('@')[0];

    const { url: adUrl, startTls, tlsOptions } = resolveConnectionSettings();
    const timeout = parseInt(process.env.AD_CONNECT_TIMEOUT_MS, 10) || 5000;
    const searchBase = process.env.AD_USER_SEARCH_BASE || process.env.AD_BASE_DN || 'DC=metschool,DC=local';
    const loginAttr = process.env.AD_LOGIN_ATTRIBUTE || 'sAMAccountName';
    const escapedAccountName = escapeLdapFilter(sAMAccountName);

    const isLdaps = adUrl.toLowerCase().startsWith('ldaps://');

    const client = new Client({
      url: adUrl,
      timeout,
      connectTimeout: timeout,
      ...(isLdaps ? { tlsOptions } : {})
    });

    try {
      // Step 0: Optionally upgrade the cleartext connection via StartTLS (fail closed).
      if (startTls && !isLdaps) {
        try {
          await client.startTLS(tlsOptions);
        } catch (tlsErr) {
          console.error(`[AD] StartTLS negotiation failed for ${adUrl}:`, tlsErr.message || tlsErr);
          throw new AdUnreachableError('Could not establish a secure (StartTLS) connection to Active Directory.');
        }
      }

      // Step 1: UPN Direct Bind with user credentials
      try {
        await client.bind(upn, password);
      } catch (bindErr) {
        const errMsg = bindErr.message || '';
        const isNetworkErr =
          bindErr.code === 'ECONNREFUSED' ||
          bindErr.code === 'ETIMEDOUT' ||
          bindErr.code === 'ENOTFOUND' ||
          bindErr.code === 'EHOSTUNREACH' ||
          errMsg.includes('Timeout') ||
          errMsg.includes('timeout') ||
          errMsg.includes('ConnectionError') ||
          errMsg.includes('connect ECONNREFUSED');

        if (isNetworkErr) {
          console.error(`[AD] Network/Connection failure connecting to ${adUrl}:`, errMsg);
          throw new AdUnreachableError(`Could not reach Active Directory server at ${adUrl}`);
        }

        // Invalid credentials, locked out, expired, etc.
        console.warn(`[AD] Authentication failed for user '${sAMAccountName}': ${errMsg}`);
        throw new AdAuthError('Invalid username or password.');
      }

      // Step 2: Search user details using the authenticated session
      let entry = null;
      try {
        const searchRes = await client.search(searchBase, {
          scope: 'sub',
          filter: `(&(objectCategory=person)(objectClass=user)(${loginAttr}=${escapedAccountName}))`,
          attributes: [
            'sAMAccountName',
            'displayName',
            'cn',
            'mail',
            'userPrincipalName',
            'department',
            'memberOf',
            'objectSid'
          ],
          sizeLimit: 1
        });

        if (searchRes && searchRes.searchEntries && searchRes.searchEntries.length > 0) {
          entry = searchRes.searchEntries[0];
        }
      } catch (searchErr) {
        console.warn(`[AD] Search query warning for '${sAMAccountName}':`, searchErr.message);
      }

      // Step 3: Extract and normalize attributes
      const displayName = firstString(entry?.displayName) || firstString(entry?.cn) || sAMAccountName;
      const email =
        firstString(entry?.mail) ||
        firstString(entry?.userPrincipalName) ||
        `${sAMAccountName}@${process.env.MICROSOFT_SENDER_EMAIL?.split('@')[1] || 'metropolitanschool.edu.eg'}`;
      const rawSid = Array.isArray(entry?.objectSid) ? entry.objectSid[0] : entry?.objectSid;
      const adSid = Buffer.isBuffer(rawSid) ? formatSid(rawSid) : (typeof rawSid === 'string' ? rawSid : null);

      const memberOf = entry?.memberOf || [];
      const role = this.resolveRole(memberOf);
      const department = this.resolveDepartment(entry?.department, memberOf);

      return {
        username: sAMAccountName.toLowerCase(),
        displayName,
        email,
        adSid,
        department,
        role,
        userPrincipalName: upn
      };
    } finally {
      try {
        await client.unbind();
      } catch (_) {
        // Safe to ignore unbind socket cleanup error
      }
    }
  }
}

module.exports = new ADService();
module.exports.AdUnreachableError = AdUnreachableError;
module.exports.AdAuthError = AdAuthError;
module.exports.formatSid = formatSid;
module.exports.escapeLdapFilter = escapeLdapFilter;
