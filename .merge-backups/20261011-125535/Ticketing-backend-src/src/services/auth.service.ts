import { prisma } from "../prisma/client";
import { AdError, authenticateUser, getUserRole } from "./ad.service";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { AppError } from "../utils/errors";
import type { Role } from "@prisma/client";

export interface AuthResult {
  user: {
    id: number;
    name: string;
    email: string | null;
    username: string;
    role: Role;
    roleLabel: string;
    departmentId: number | null;
  };
  accessToken: string;
  refreshToken: string;
}

export async function login(username: string, password: string): Promise<AuthResult> {
  let adUser;
  try {
    adUser = await authenticateUser(username, password);
  } catch (err) {
    if (err instanceof AdError) {
      throw new AppError(401, err.message);
    }
    throw new AppError(502, "Could not reach Active Directory. Please contact the IT team.");
  }

  const { role, roleLabel } = getUserRole(adUser.memberOf);

  console.log(
    `[ad-groups] username=${username} groups=${JSON.stringify(adUser.memberOf)} -> role=${role} label=${roleLabel}`
  );

  const user = await prisma.user.upsert({
    where: { username },
    update: {
      name: adUser.name,
      email: adUser.email ?? undefined,
      adSid: adUser.objectSid ?? undefined,
      role,
      roleLabel,
    },
    create: {
      username,
      name: adUser.name,
      email: adUser.email,
      adSid: adUser.objectSid,
      role,
      roleLabel,
    },
  });

  const payload = { userId: user.id, username: user.username, role: user.role };

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      roleLabel: user.roleLabel,
      departmentId: user.departmentId,
    },
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

export async function refresh(refreshToken: string): Promise<AuthResult> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, "Invalid or expired refresh token. Please log in again.");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    throw new AppError(401, "User no longer exists. Please log in again.");
  }

  const newPayload = { userId: user.id, username: user.username, role: user.role };

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      roleLabel: user.roleLabel,
      departmentId: user.departmentId,
    },
    accessToken: signAccessToken(newPayload),
    refreshToken: signRefreshToken(newPayload),
  };
}

export async function me(userId: number): Promise<AuthResult["user"]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { department: true },
  });
  if (!user) {
    throw new AppError(401, "User no longer exists.");
  }

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
