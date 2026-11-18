const jwt = require('jsonwebtoken');
const authService = require('../services/authService');

/**
 * Extracts the Bearer access token issued by the unified host auth service.
 */
function extractToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7);
}

/**
 * Requires a valid host-issued JWT and resolves the corresponding Maintenance
 * user profile. Sessions are no longer used; authorization is derived purely
 * from the shared JWT principal.
 */
const requireAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          details: {}
        }
      });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (_err) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
          details: {}
        }
      });
    }

    const user = await authService.getUserByUsername(payload.username);
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User account no longer exists',
          details: {}
        }
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: {
          code: 'ACCOUNT_DEACTIVATED',
          message: 'Account has been deactivated',
          details: {}
        }
      });
    }

    req.user = user;
    req.jwt = payload;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to authenticate user',
        details: {}
      }
    });
  }
};

/**
 * Middleware factory enforcing Maintenance RBAC. ADMIN always passes.
 * @param {...string} allowedRoles
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          details: {}
        }
      });
    }

    const userRole = req.user.role?.name;
    if (!userRole || (!allowedRoles.includes(userRole) && userRole !== 'ADMIN')) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Forbidden: requires one of [${allowedRoles.join(', ')}] role`,
          details: { requiredRoles: allowedRoles, currentRole: userRole }
        }
      });
    }

    next();
  };
};

module.exports = { requireAuth, requireRole };
