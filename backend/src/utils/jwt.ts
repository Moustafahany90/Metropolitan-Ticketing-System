import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { env } from "../config/env";

export interface JwtUserPayload {
  userId: number;
  username: string;
  role: string;
  jti?: string;
}

export interface IssuedRefreshToken {
  token: string;
  jti: string;
  expiresAt: Date;
}

const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function parseDurationMs(input: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d)?$/i.exec(String(input).trim());
  if (!match) {
    throw new Error(`Invalid duration: ${input}`);
  }
  const value = Number(match[1]);
  const unit = (match[2] ?? "s").toLowerCase();
  return value * UNIT_MS[unit];
}

export function signAccessToken(payload: JwtUserPayload): string {
  const { jti: _jti, ...rest } = payload;
  return jwt.sign(rest, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

/**
 * Issues a refresh token carrying a unique `jti`. The caller persists a
 * RefreshToken row keyed by `jti` so the token can be revoked server-side
 * (logout / rotation) rather than relying on stateless expiry alone.
 */
export function issueRefreshToken(payload: JwtUserPayload): IssuedRefreshToken {
  const jti = payload.jti ?? randomUUID();
  const { jti: _ignored, ...rest } = payload;
  const token = jwt.sign({ ...rest, jti }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
  return {
    token,
    jti,
    expiresAt: new Date(Date.now() + parseDurationMs(env.JWT_REFRESH_EXPIRES_IN)),
  };
}

export function verifyAccessToken(token: string): JwtUserPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtUserPayload;
}

export function verifyRefreshToken(token: string): JwtUserPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtUserPayload;
}
