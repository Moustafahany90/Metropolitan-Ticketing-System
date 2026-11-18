const authService = require('../services/authService');

/**
 * Middleware to require authenticated user session
 */
const requireAuth = async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          details: {}
        }
      });
    }

    const user = await authService.getUserById(req.session.userId);

    if (!user) {
      req.session.destroy();
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User account no longer exists',
          details: {}
        }
      });
    }

    if (!user.isActive) {
      req.session.destroy();
      return res.status(403).json({
        error: {
          code: 'ACCOUNT_DEACTIVATED',
          message: 'Account has been deactivated',
          details: {}
        }
      });
    }

    // Attach user object to request
    req.user = user;
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
 * Middleware factory to enforce RBAC permissions
 * @param  {...string} allowedRoles 
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

module.exports = {
  requireAuth,
  requireRole
};
