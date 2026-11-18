const adService = require('./adService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class AuthService {
  /**
   * Authenticate user against Active Directory and synchronize the local user record.
   * There is NO mock/dev/fallback path: a user is only returned when the credentials
   * are successfully validated against the real AD server.
   * @param {string} username - AD sAMAccountName
   * @param {string} password - User password
   * @returns {Promise<Object>} Authenticated user object
   */
  async authenticateUser(username, password) {
    const cleanUsername = (username || '').trim().toLowerCase();
    if (!cleanUsername || !password) {
      const { AdAuthError } = adService;
      throw new AdAuthError('Username and password are required');
    }

    // Production Active Directory Authentication via ldapts (fail closed).
    const adUser = await adService.authenticateUser(username, password);

    if (!adUser) {
      return null;
    }

    // Sync user with local database
    const dbUser = await this.syncUserFromAD(adUser);
    return dbUser;
  }

  /**
   * Sync user from AD to local database
   * @param {Object} adUser - User object from AD
   * @returns {Promise<Object>} User object from database
   */
  async syncUserFromAD(adUser) {
    const username = adUser.username.toLowerCase();

    // Find existing user by username
    let user = await prisma.user.findUnique({
      where: { username },
      include: {
        role: true,
        department: true
      }
    });

    // Handle department
    let department = null;
    if (adUser.department) {
      department = await prisma.department.upsert({
        where: { name: adUser.department },
        update: {},
        create: {
          name: adUser.department
        }
      });
    }

    // Target application role
    const targetRoleName = adUser.role || adUser.preferredRole || 'EMPLOYEE';
    let targetRole = await prisma.role.findFirst({
      where: { name: targetRoleName }
    });

    if (!targetRole) {
      targetRole = await prisma.role.create({
        data: {
          name: targetRoleName,
          description: `${targetRoleName} role`
        }
      });
    }

    // If user doesn't exist, create new one
    if (!user) {
      user = await prisma.user.create({
        data: {
          username,
          displayName: adUser.displayName || username,
          email: adUser.email,
          adSid: adUser.adSid || null,
          departmentId: department ? department.id : null,
          roleId: targetRole.id,
          isActive: true,
          lastLoginAt: new Date()
        },
        include: {
          role: true,
          department: true
        }
      });
    } else {
      // Update existing user with latest AD info & update login timestamp
      const updateData = {
        displayName: adUser.displayName || user.displayName,
        email: adUser.email || user.email,
        lastLoginAt: new Date(),
        updatedAt: new Date()
      };

      if (adUser.adSid) {
        updateData.adSid = adUser.adSid;
      }

      if (department) {
        updateData.departmentId = department.id;
      }

      // Update role if resolved role differs
      if (targetRole && user.roleId !== targetRole.id) {
        updateData.roleId = targetRole.id;
      }

      user = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
        include: {
          role: true,
          department: true
        }
      });
    }

    return user;
  }

  /**
   * Get user by ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} User object
   */
  async getUserById(userId) {
    return await prisma.user.findUnique({
      where: { id: Number(userId) },
      include: {
        role: true,
        department: true
      }
    });
  }

  /**
   * Get user by username
   * @param {string} username - Username
   * @returns {Promise<Object>} User object
   */
  async getUserByUsername(username) {
    return await prisma.user.findUnique({
      where: { username: (username || '').toLowerCase() },
      include: {
        role: true,
        department: true
      }
    });
  }

  /**
   * Update user role (Admin operation)
   * @param {number} userId - User ID
   * @param {string} roleName - New Role Name
   * @returns {Promise<Object>}
   */
  async updateUserRole(userId, roleName) {
    const role = await prisma.role.findUnique({
      where: { name: roleName }
    });

    if (!role) {
      throw new Error(`Role '${roleName}' does not exist`);
    }

    return await prisma.user.update({
      where: { id: Number(userId) },
      data: { roleId: role.id },
      include: {
        role: true,
        department: true
      }
    });
  }

  /**
   * List users
   */
  async listUsers() {
    return await prisma.user.findMany({
      include: {
        role: true,
        department: true
      },
      orderBy: { username: 'asc' }
    });
  }

  /**
   * Deactivate user (soft delete)
   */
  async deactivateUser(userId) {
    return await prisma.user.update({
      where: { id: Number(userId) },
      data: { isActive: false }
    });
  }

  /**
   * Activate user
   */
  async activateUser(userId) {
    return await prisma.user.update({
      where: { id: Number(userId) },
      data: { isActive: true }
    });
  }
}

module.exports = new AuthService();