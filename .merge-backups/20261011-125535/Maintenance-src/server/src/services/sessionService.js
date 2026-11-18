const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class SessionService {
  constructor() {
    this.sessionTimeout = parseInt(process.env.SESSION_IDLE_TIMEOUT) || 3600000; // 1 hour default
    this.maxAge = parseInt(process.env.SESSION_MAX_AGE) || 28800000; // 8 hours default
  }

  /**
   * Create or update a session in the database
   * @param {string} sessionId - Express session ID
   * @param {number} userId - User ID
   * @param {string} ipAddress - IP address
   * @param {string} userAgent - User agent
   * @returns {Promise<Object>} Session object
   */
  async createSession(sessionId, userId, ipAddress = null, userAgent = null) {
    const expiresAt = new Date(Date.now() + this.maxAge);

    return await prisma.session.upsert({
      where: { id: sessionId },
      update: {
        userId,
        ipAddress,
        userAgent,
        expiresAt,
        updatedAt: new Date()
      },
      create: {
        id: sessionId,
        userId,
        ipAddress,
        userAgent,
        expiresAt
      }
    });
  }

  /**
   * Find session by ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} Session object
   */
  async findSession(sessionId) {
    if (!sessionId) return null;
    return await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          include: {
            role: true,
            department: true
          }
        }
      }
    });
  }

  /**
   * Destroy session
   * @param {string} sessionId - Session ID
   * @returns {Promise<void>}
   */
  async destroySession(sessionId) {
    if (!sessionId) return;
    try {
      await prisma.session.delete({
        where: { id: sessionId }
      });
    } catch (err) {
      // Ignore record not found error
    }
  }

  /**
   * Clean up expired sessions
   * @returns {Promise<number>} Number of sessions deleted
   */
  async cleanupExpiredSessions() {
    try {
      const result = await prisma.session.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });
      return result.count;
    } catch (err) {
      console.error('Session cleanup error:', err);
      return 0;
    }
  }
}

module.exports = new SessionService();