const prisma = require('../db');

/**
 * User persistence for the Maintenance module.
 *
 * Authentication itself is performed once by the unified host AD service; this
 * service only synchronizes the resolved AD profile into the maintenance
 * database and provides lookups used by the JWT auth middleware / RBAC.
 */
class AuthService {
  /**
   * Synchronize an AD-resolved user into the maintenance database.
   * @param {{ username: string, displayName?: string, email?: string|null, adSid?: string|null, department?: string|null, role?: string, preferredRole?: string }} adUser
   */
  async syncUserFromAD(adUser) {
    const username = String(adUser.username || '').toLowerCase();
    if (!username) {
      throw new Error('syncUserFromAD requires a username');
    }

    const existing = await prisma.user.findUnique({
      where: { username },
      include: { role: true, department: true }
    });

    let department = null;
    if (adUser.department) {
      department = await prisma.department.upsert({
        where: { name: adUser.department },
        update: {},
        create: { name: adUser.department }
      });
    }

    const targetRoleName = adUser.role || adUser.preferredRole || 'EMPLOYEE';
    let targetRole = await prisma.role.findUnique({ where: { name: targetRoleName } });
    if (!targetRole) {
      targetRole = await prisma.role.create({
        data: { name: targetRoleName, description: `${targetRoleName} role` }
      });
    }

    if (!existing) {
      return await prisma.user.create({
        data: {
          username,
          displayName: adUser.displayName || username,
          email: adUser.email || null,
          adSid: adUser.adSid || null,
          departmentId: department ? department.id : null,
          roleId: targetRole.id,
          isActive: true,
          lastLoginAt: new Date()
        },
        include: { role: true, department: true }
      });
    }

    const updateData = {
      displayName: adUser.displayName || existing.displayName,
      email: adUser.email || existing.email,
      lastLoginAt: new Date()
    };
    if (adUser.adSid) updateData.adSid = adUser.adSid;
    if (department) updateData.departmentId = department.id;
    if (targetRole && existing.roleId !== targetRole.id) updateData.roleId = targetRole.id;

    return await prisma.user.update({
      where: { id: existing.id },
      data: updateData,
      include: { role: true, department: true }
    });
  }

  async getUserById(userId) {
    return await prisma.user.findUnique({
      where: { id: Number(userId) },
      include: { role: true, department: true }
    });
  }

  /**
   * Look up a maintenance user by username. Usernames are stored in lower case
   * (see syncUserFromAD), so normalize the incoming value here — the shared JWT
   * principal may carry a differently-cased sAMAccountName (e.g. "John.Doe").
   * @param {string} username
   */
  async getUserByUsername(username) {
    const normalized = String(username || '').trim().toLowerCase();
    return await prisma.user.findUnique({
      where: { username: normalized },
      include: { role: true, department: true }
    });
  }

  async updateUserRole(userId, roleName) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      throw new Error(`Role '${roleName}' does not exist`);
    }
    return await prisma.user.update({
      where: { id: Number(userId) },
      data: { roleId: role.id },
      include: { role: true, department: true }
    });
  }

  async listUsers() {
    return await prisma.user.findMany({
      include: { role: true, department: true },
      orderBy: { username: 'asc' }
    });
  }

  async deactivateUser(userId) {
    return await prisma.user.update({
      where: { id: Number(userId) },
      data: { isActive: false }
    });
  }

  async activateUser(userId) {
    return await prisma.user.update({
      where: { id: Number(userId) },
      data: { isActive: true }
    });
  }
}

module.exports = new AuthService();
