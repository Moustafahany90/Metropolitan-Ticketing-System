import { Client } from "ldapts";
import net from "net";
import { env } from "../config/env";

export type ItRole = "EMPLOYEE" | "TECHNICIAN";
export type MaintenanceRole =
  | "EMPLOYEE"
  | "SUPERVISOR"
  | "MAINTENANCE_WORKER"
  | "STORE_KEEPER"
  | "ADMIN";

export interface AdUser {
  username: string;
  name: string;
  displayName: string;
  email: string;
  adSid: string | null;
  objectSid: string | null;
  department: string | null;
  memberOf: string[];
  userPrincipalName: string;
  itRole: ItRole;
  itRoleLabel: string;
  maintenanceRole: MaintenanceRole;
}

export class AdAuthError extends Error {
  status = 401;
  code = "INVALID_CREDENTIALS";

  constructor(message = "Invalid username or password.") {
    super(message);
    this.name = "AdAuthError";
  }
}

export class AdUnreachableError extends Error {
  status = 502;
  code = "AD_UNREACHABLE";

  constructor(message = "Could not reach Active Directory server.") {
    super(message);
    this.name = "AdUnreachableError";
  }
}

// Backwards-compatible alias: historically the host service surfaced auth
// failures as `AdError`. It is the same class as AdAuthError.
export const AdError = AdAuthError;

function domainFromBaseDn(baseDn: string): string {
  return baseDn
    .split(",")
    .filter((part) => part.trim().toUpperCase().startsWith("DC="))
    .map((part) => part.trim().slice(3))
    .join(".");
}

function formatSid(buffer: Buffer): string | null {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 8) return null;
  try {
    const revision = buffer.readUInt8(0);
    const subAuthorityCount = buffer.readUInt8(1);
    const authority = buffer.readUIntBE(2, 6);
    let sid = `S-${revision}-${authority}`;
    for (let i = 0; i < subAuthorityCount; i++) {
      sid += `-${buffer.readUInt32BE(8 + i * 4)}`;
    }
    return sid;
  } catch {
    return null;
  }
}

function groupCn(dn: string): string {
  const match = /^CN=([^,]+)/i.exec(String(dn));
  return match ? match[1].trim() : String(dn).trim();
}

function singularize(value: string): string {
  return value.length > 1 && value.endsWith("s") ? value.slice(0, -1) : value;
}

/**
 * Normalizes an LDAP attribute that may be returned as a string, an array of
 * strings, or a Buffer. Callers must never assume a concrete JS type.
 */
function firstString(value: unknown): string {
  if (Array.isArray(value)) {
    const first = value.find((v) => v !== undefined && v !== null && v !== "");
    return first === undefined ? "" : String(first).trim();
  }
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (value === undefined || value === null || value === "") return [];
  return [String(value)];
}

/**
 * Escapes a value for safe inclusion in an LDAP search filter per RFC 4515,
 * preventing LDAP injection (e.g. `admin)(objectClass=*`).
 */
export function escapeLdapFilter(value: string): string {
  return String(value).replace(/[\0()*\\]/g, (char) => {
    return `\\${char.charCodeAt(0).toString(16).padStart(2, "0")}`;
  });
}

function parseEnvList(value: string | undefined, fallback: string[]): string[] {
  const raw = value && value.trim().length > 0 ? value : fallback.join(",");
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * IT module role mapping:
 *   - Member of ANY group in AD_TECHNICIAN_GROUPS (exact CN match, case-insensitive) -> TECHNICIAN
 *   - Everyone else -> EMPLOYEE
 * The role label is the display name of the group the user matched (the original,
 * case-preserving group name - never a lowercased placeholder).
 */
export function resolveItRole(memberOf: string[]): { role: ItRole; roleLabel: string } {
  const groupCns = memberOf.map(groupCn);
  const technicianGroups = (env.AD_TECHNICIAN_GROUPS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const match = technicianGroups.find((g) =>
    groupCns.some((cn) => cn.toLowerCase() === g.toLowerCase())
  );
  if (match) {
    return { role: "TECHNICIAN", roleLabel: match };
  }
  return { role: "EMPLOYEE", roleLabel: "Employee" };
}

/**
 * Maintenance module role mapping (priority order, case-insensitive CN match):
 *   ADMIN > SUPERVISOR > MAINTENANCE_WORKER > STORE_KEEPER > EMPLOYEE
 */
export function resolveMaintenanceRole(memberOf: string[]): MaintenanceRole {
  const groupCns = memberOf.map(groupCn).map((g) => g.toLowerCase());

  const adminGroups = parseEnvList(env.AD_ADMIN_GROUPS, [
    "Domain Admins",
    "IT Administrators",
  ]);
  const supervisorGroups = parseEnvList(env.AD_SUPERVISOR_GROUPS, [
    "Maintenance Supervisors",
    "Facilities Management",
  ]);
  const workerGroups = parseEnvList(env.AD_WORKER_GROUPS, [
    "Maintenance Technicians",
    "Maintenance Workers",
  ]);
  const storekeeperGroups = parseEnvList(env.AD_STOREKEEPER_GROUPS, [
    "Store Keepers",
    "Inventory Staff",
  ]);

  const has = (list: string[]): boolean =>
    groupCns.some((cn) => list.includes(cn));

  if (has(adminGroups)) return "ADMIN";
  if (has(supervisorGroups)) return "SUPERVISOR";
  if (has(workerGroups)) return "MAINTENANCE_WORKER";
  if (has(storekeeperGroups)) return "STORE_KEEPER";
  return "EMPLOYEE";
}

/**
 * Resolves the department from the direct AD `department` attribute, falling
 * back to group-based mapping (AD_DEPARTMENT_GROUPS, format `CN=DeptName,...`).
 */
export function resolveDepartment(
  directDepartment: unknown,
  memberOf: string[]
): string | null {
  const direct = firstString(directDepartment);
  if (direct) return direct;

  const mapping = env.AD_DEPARTMENT_GROUPS;
  if (!mapping) return null;

  const groupCns = memberOf.map(groupCn).map((g) => g.toLowerCase());
  const pairs = mapping.split(",").map((p) => p.trim());
  for (const pair of pairs) {
    const [cn, dept] = pair.split("=").map((s) => s.trim());
    if (cn && dept && groupCns.includes(cn.toLowerCase())) {
      return dept;
    }
  }
  return null;
}

function resolveConnectionSettings(): {
  url: string;
  startTls: boolean;
  tlsOptions: { rejectUnauthorized?: boolean };
} {
  const url = env.AD_URL;
  const startTls = env.AD_STARTTLS === true;

  const tlsOptions: { rejectUnauthorized?: boolean } = {};
  if (env.AD_TLS_REJECT_UNAUTHORIZED === "false") {
    tlsOptions.rejectUnauthorized = false;
    console.warn(
      "[AD] TLS certificate validation is DISABLED (AD_TLS_REJECT_UNAUTHORIZED=false)."
    );
  }
  return { url, startTls, tlsOptions };
}

function createClient(url: string, tlsOptions: { rejectUnauthorized?: boolean }): Client {
  return new Client({
    url,
    timeout: env.AD_CONNECT_TIMEOUT_MS,
    connectTimeout: env.AD_CONNECT_TIMEOUT_MS,
    ...(url.toLowerCase().startsWith("ldaps://") ? { tlsOptions } : {}),
  });
}

function isNetworkError(err: { code?: string; message?: string }): boolean {
  const code = err.code ?? "";
  const message = err.message ?? "";
  return (
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "EHOSTUNREACH" ||
    /timeout|timed out|connectionerror|econnrefused|enotfound|network|socket/i.test(
      `${code} ${message}`
    )
  );
}

/**
 * Authenticates against Active Directory via UPN direct bind and returns the
 * normalized user profile with both IT and Maintenance role mappings resolved.
 *
 * Fails closed:
 *   - invalid/missing credentials -> AdError (401)
 *   - DC unreachable / TLS failure -> AdUnreachableError (502)
 */
export async function authenticateUser(username: string, password: string): Promise<AdUser> {
  const cleanUsername = (username ?? "").trim();
  if (!cleanUsername || !password) {
    throw new AdError("Username and password are required.");
  }

  const domain = env.AD_DOMAIN ?? domainFromBaseDn(env.AD_BASE_DN);
  const upn = cleanUsername.includes("@") ? cleanUsername : `${cleanUsername}@${domain}`;
  const sAMAccountName = cleanUsername.split("@")[0];

  const { url, startTls, tlsOptions } = resolveConnectionSettings();
  const isLdaps = url.toLowerCase().startsWith("ldaps://");
  const loginAttr = env.AD_LOGIN_ATTRIBUTE ?? env.AD_USER_LOGIN_ATTRIBUTE;
  const escapedAccountName = escapeLdapFilter(sAMAccountName);

  const client = createClient(url, tlsOptions);

  try {
    if (startTls && !isLdaps) {
      try {
        await client.startTLS(tlsOptions);
      } catch (tlsErr) {
        console.error(
          `[AD] StartTLS negotiation failed for ${url}:`,
          (tlsErr as Error).message ?? tlsErr
        );
        throw new AdUnreachableError(
          "Could not establish a secure (StartTLS) connection to Active Directory."
        );
      }
    }

    try {
      await client.bind(upn, password);
    } catch (bindErr) {
      if (isNetworkError(bindErr as { code?: string; message?: string })) {
        console.error(
          `[AD] Network/connection failure connecting to ${url}:`,
          (bindErr as Error).message
        );
        throw new AdUnreachableError(`Could not reach Active Directory server at ${url}`);
      }
      console.warn(
        `[AD] Authentication failed for user '${sAMAccountName}':`,
        (bindErr as Error).message
      );
      throw new AdError("Invalid username or password.");
    }

    let entry: Record<string, unknown> | undefined;
    try {
      const { searchEntries } = await client.search(env.AD_USER_SEARCH_BASE, {
        scope: "sub",
        filter: `(&(objectCategory=person)(objectClass=user)(${loginAttr}=${escapedAccountName}))`,
        attributes: [
          "sAMAccountName",
          "displayName",
          "cn",
          "mail",
          "userPrincipalName",
          "department",
          "memberOf",
          "objectSid",
        ],
        sizeLimit: 1,
      });
      entry = searchEntries[0] as Record<string, unknown> | undefined;
    } catch (searchErr) {
      console.warn(
        `[AD] Search query warning for '${sAMAccountName}':`,
        (searchErr as Error).message
      );
    }

    const displayName =
      firstString(entry?.displayName) || firstString(entry?.cn) || sAMAccountName;
    const email =
      firstString(entry?.mail) ||
      firstString(entry?.userPrincipalName) ||
      `${sAMAccountName}@${domain}`;

    const rawSid = Array.isArray(entry?.objectSid) ? entry.objectSid[0] : entry?.objectSid;
    const adSid = Buffer.isBuffer(rawSid)
      ? formatSid(rawSid)
      : typeof rawSid === "string"
        ? rawSid
        : null;

    const memberOf = toStringArray(entry?.memberOf);
    const { role: itRole, roleLabel: itRoleLabel } = resolveItRole(memberOf);
    const maintenanceRole = resolveMaintenanceRole(memberOf);
    const department = resolveDepartment(entry?.department, memberOf);

    return {
      username: sAMAccountName.toLowerCase(),
      name: displayName,
      displayName,
      email,
      adSid,
      objectSid: adSid,
      department,
      memberOf,
      userPrincipalName: upn,
      itRole,
      itRoleLabel,
      maintenanceRole,
    };
  } finally {
    await client.unbind().catch(() => undefined);
  }
}

/**
 * Lightweight TCP reachability probe (does not require bind rights).
 */
export async function checkAdReachability(): Promise<{
  reachable: boolean;
  detail: string;
  adUrl: string;
  latencyMs: number;
}> {
  const adUrl = env.AD_URL;
  let host = "localhost";
  let port = 389;
  try {
    const parsed = new URL(adUrl);
    host = parsed.hostname || host;
    port = parseInt(parsed.port, 10) || (parsed.protocol === "ldaps:" ? 636 : 389);
  } catch {
    // Keep defaults if the URL is malformed.
  }

  const timeout = env.AD_CONNECT_TIMEOUT_MS;
  const start = Date.now();

  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);

    const done = (reachable: boolean, detail: string): void => {
      socket.destroy();
      resolve({ reachable, detail, adUrl, latencyMs: Date.now() - start });
    };

    socket.on("connect", () => done(true, "AD reachable"));
    socket.on("timeout", () => done(false, `Connection timed out after ${timeout}ms`));
    socket.on("error", (err: Error) => done(false, `AD unreachable: ${err.message}`));
    socket.connect(port, host);
  });
}
