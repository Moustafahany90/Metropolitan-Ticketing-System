import { prisma } from "../prisma/client";
import { AdError, AdUnreachableError, authenticateUser } from "./ad.service";
import {
  getMaintenancePrincipal,
  syncMaintenanceUser,
  type MaintenancePrincipal,
} from "./maintenance-sync.service";
import {
  issueRefreshToken,
  signAccessToken,
  verifyRefreshToken,
} from "../utils/jwt";
import { AppError } from "../utils/errors";
import type { Role } from "@prisma/client";

export interface AuthUser {
  id: number;
  name: string;
  email: string | null;
  username: string;
  role: Role;
  roleLabel: string;
  departmentId: number | null;
  maintenance?: MaintenancePrincipal | null;
}

export interface AuthResult {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

function toAuthUser(user: {
  id: number;
  name: string;
  email: string | null;
  username: string;
  role: Role;
  roleLabel: string;
  departmentId: number | null;
}): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    role: user.role,
    roleLabel: user.roleLabel,
    departmentId: user.departmentId,
  };
}

export async function login(username: string, password: string): Promise<AuthResult> {
  let adUser;
  try {
    adUser = await authenticateUser(username, password);
  } catch (err) {
    if (err instanceof AdUnreachableError) {
      throw new AppError(502, err.message);
    }
    if (err instanceof AdError) {
      throw new AppError(401, err.message);
    }
    throw new AppError(502, "Could not reach Active Directory. Please contact the IT team.");
  }

  const { itRole: role, itRoleLabel: roleLabel } = adUser;

  // Canonical identity boundary: the AD sAMAccountName, normalized to lower
  // case (as returned by the AD service). The Maintenance module stores users
  // in lower case, so normalizing here ensures an access token minted for
  // "John.Doe" resolves to the same identity there. Display names are never
  // altered. The lookup is case-insensitive so pre-existing mixed-case rows are
  // reconciled rather than duplicated.
  const identity = adUser.username;

  console.log(
    `[ad-groups] username=${identity} itRole=${role} maintenanceRole=${adUser.maintenanceRole} label=${roleLabel}`
  );

  const existing = await prisma.user.findFirst({
    where: { username: { equals: identity, mode: "insensitive" } },
  });

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          username: identity,
          name: adUser.name,
          email: adUser.email ?? undefined,
          adSid: adUser.adSid ?? undefined,
          role,
          roleLabel,
        },
      })
    : await prisma.user.create({
        data: {
          username: identity,
          name: adUser.name,
          email: adUser.email,
          adSid: adUser.adSid,
          role,
          roleLabel,
        },
      });

  const payload = { userId: user.id, username: user.username, role: user.role };
  const issued = issueRefreshToken(payload);

  await prisma.refreshToken.create({
    data: { id: issued.jti, userId: user.id, expiresAt: issued.expiresAt },
  });

  const maintenance = await syncMaintenanceUser(adUser);

  return {
    user: { ...toAuthUser(user), maintenance },
    accessToken: signAccessToken(payload),
    refreshToken: issued.token,
  };
}

export async function refresh(refreshToken: string): Promise<AuthResult> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, "Invalid or expired refresh token. Please log in again.");
  }

  if (!payload.jti) {
    throw new AppError(401, "Invalid refresh token. Please log in again.");
  }

  const record = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });
  if (!record || record.revokedAt || record.expiresAt.getTime() <= Date.now()) {
    throw new AppError(401, "Session expired or has been revoked. Please log in again.");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    throw new AppError(401, "User no longer exists. Please log in again.");
  }

  const newPayload = { userId: user.id, username: user.username, role: user.role };
  const issued = issueRefreshToken(newPayload);

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: { id: issued.jti, userId: user.id, expiresAt: issued.expiresAt },
    }),
  ]);

  return {
    user: toAuthUser(user),
    accessToken: signAccessToken(newPayload),
    refreshToken: issued.token,
  };
}

/**
 * Revokes the supplied refresh token server-side so it (and therefore the
 * session) can no longer be used, then returns success. Malformed, expired or
 * unknown tokens are treated as already-invalid (idempotent logout).
 */
export async function logout(refreshToken?: string): Promise<{ success: boolean }> {
  if (refreshToken) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      if (payload.jti) {
        await prisma.refreshToken.updateMany({
          where: { id: payload.jti, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    } catch {
      // Invalid/expired token: nothing to revoke.
    }
  }
  return { success: true };
}

export async function me(userId: number): Promise<AuthUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(401, "User no longer exists.");
  }
  const maintenance = await getMaintenancePrincipal(user.username);
  return { ...toAuthUser(user), maintenance };
}
