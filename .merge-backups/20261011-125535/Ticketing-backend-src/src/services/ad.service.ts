import { Client, EqualityFilter } from "ldapts";
import { env } from "../config/env";

export interface AdUser {
  dn: string;
  name: string;
  email?: string | null;
  objectSid?: string | null;
  memberOf: string[];
}

export class AdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdError";
  }
}

function domainFromBaseDn(baseDn: string): string {
  return baseDn
    .split(",")
    .filter((part) => part.trim().toUpperCase().startsWith("DC="))
    .map((part) => part.trim().slice(3))
    .join(".");
}

function sidToString(sid: Buffer): string {
  const parts: string[] = [];
  const revision = sid[0];
  const subAuthorityCount = sid[1];
  parts.push(`S-${revision}`);
  let authority = 0n;
  for (let i = 2; i < 8; i++) {
    authority = (authority << 8n) | BigInt(sid[i]);
  }
  parts.push(authority.toString());
  let offset = 8;
  for (let i = 0; i < subAuthorityCount; i++) {
    parts.push(sid.readUInt32LE(offset).toString());
    offset += 4;
  }
  return parts.join("-");
}

function groupCn(dn: string): string {
  const match = dn.match(/^CN=([^,]+)/i);
  return match ? match[1] : dn;
}

function singularize(name: string): string {
  if (name.length > 1 && name.toLowerCase().endsWith("s")) {
    return name.slice(0, -1);
  }
  return name;
}

/**
 * Role mapping:
 *   - User in ANY group listed in AD_TECHNICIAN_GROUPS (exact CN match) -> TECHNICIAN
 *   - Everyone else -> EMPLOYEE
 * Role label: cleaned singular form of the first matching group (env order).
 * No fuzzy/name-based matching is performed.
 */
export function getUserRole(
  memberOf: string[]
): { role: "EMPLOYEE" | "TECHNICIAN"; roleLabel: string } {
  const groupNames = new Set(memberOf.map(groupCn));

  const mapped = (envList: string | undefined): string[] =>
    (envList ?? "")
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);

  const technicianGroups = mapped(env.AD_TECHNICIAN_GROUPS);

  const match = technicianGroups.find((g) => groupNames.has(g));
  if (match) {
    return { role: "TECHNICIAN", roleLabel: singularize(match) };
  }
  return { role: "EMPLOYEE", roleLabel: "Academic" };
}

function createClient(): Client {
  return new Client({
    url: env.AD_URL,
    timeout: 10_000,
  });
}

export async function authenticateUser(username: string, password: string): Promise<AdUser> {
  const client = createClient();
  const domain = domainFromBaseDn(env.AD_BASE_DN);
  const bindDn = `${username}@${domain}`;

  try {
    await client.bind(bindDn, password);
  } catch {
    throw new AdError("Invalid username or password.");
  }

  try {
    const user = await findUser(client, username);
    if (!user) {
      throw new AdError("Authenticated user was not found in Active Directory.");
    }
    return user;
  } finally {
    await client.unbind().catch(() => undefined);
  }
}

export async function findUser(client: Client, username: string): Promise<AdUser | null> {
  const filter = new EqualityFilter({
    attribute: env.AD_USER_LOGIN_ATTRIBUTE,
    value: username,
  });

  const { searchEntries } = await client.search(env.AD_USER_SEARCH_BASE, {
    scope: "sub",
    filter,
    attributes: ["cn", "displayName", "mail", "objectSid", "memberOf"],
    sizeLimit: 1,
  });

  const entry = searchEntries[0];
  if (!entry) return null;

  const sid = entry.objectSid as Buffer | undefined;
  const asString = (value: unknown): string | undefined => {
    if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
    return typeof value === "string" ? value : undefined;
  };
  const mail = asString(entry.mail);
  const displayName = asString(entry.displayName);
  const cn = asString(entry.cn);

  return {
    dn: entry.dn,
    name: displayName || cn || username,
    email: mail ?? null,
    objectSid: sid ? sidToString(sid) : null,
    memberOf: Array.isArray(entry.memberOf)
      ? (entry.memberOf as string[])
      : entry.memberOf
        ? [entry.memberOf as string]
        : [],
  };
}

export async function checkAdReachability(): Promise<{ reachable: boolean; detail: string }> {
  const client = createClient();
  try {
    await client.bind("", "");
    return { reachable: true, detail: "AD reachable (anonymous bind accepted)" };
  } catch (err) {
    const name = (err as { name?: string }).name ?? "";
    const message = (err as { message?: string }).message ?? "";
    if (/timeout|connect|network|socket|ECONN/i.test(`${name} ${message}`)) {
      return { reachable: false, detail: `AD unreachable: ${message}` };
    }
    return { reachable: true, detail: `AD reachable (anonymous bind rejected: ${message})` };
  } finally {
    await client.unbind().catch(() => undefined);
  }
}
