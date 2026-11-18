import type { AdUser } from "./ad.service";

/* eslint-disable @typescript-eslint/no-var-requires */
// The Maintenance module stays CommonJS (per architecture decision) and is
// consumed from the TypeScript host through this thin bridge.
const maintenanceAuthService = require("../../maintenance/src/services/authService");

export interface MaintenancePrincipal {
  id: number;
  username: string;
  displayName: string | null;
  role: string;
  department: string | null;
  isActive: boolean;
}

interface MaintenanceDbUser {
  id: number;
  username: string;
  displayName: string | null;
  isActive: boolean;
  role?: { name?: string } | null;
  department?: { name?: string } | null;
}

function toPrincipal(user: MaintenanceDbUser | null): MaintenancePrincipal | null {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role?.name ?? "EMPLOYEE",
    department: user.department?.name ?? null,
    isActive: user.isActive,
  };
}

/**
 * Synchronizes the AD-resolved profile into the Maintenance database and
 * returns the resulting maintenance principal (role + department).
 * Failures are non-fatal for IT login: the IT session is still established,
 * but the Maintenance module will be unavailable until the next login.
 */
export async function syncMaintenanceUser(adUser: AdUser): Promise<MaintenancePrincipal | null> {
  try {
    const user: MaintenanceDbUser = await maintenanceAuthService.syncUserFromAD({
      username: adUser.username,
      displayName: adUser.displayName,
      email: adUser.email,
      adSid: adUser.adSid,
      department: adUser.department,
      role: adUser.maintenanceRole,
    });
    return toPrincipal(user);
  } catch (err) {
    console.error("[maintenance-sync] sync failed:", (err as Error).message);
    return null;
  }
}

export async function getMaintenancePrincipal(
  username: string
): Promise<MaintenancePrincipal | null> {
  try {
    const user: MaintenanceDbUser | null =
      await maintenanceAuthService.getUserByUsername(username);
    return toPrincipal(user);
  } catch (err) {
    console.error("[maintenance-sync] lookup failed:", (err as Error).message);
    return null;
  }
}
