const authService = require('../services/authService');
const sessionService = require('../services/sessionService');
const adService = require('../services/adService');

/**
 * Login endpoint
 * @route POST /api/auth/login
 */
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Username and password are required',
          details: {}
        }
      });
    }

    // Authenticate user against AD / dev auth
    const user = await authService.authenticateUser(username, password);

    if (!user) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password',
          details: {}
        }
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        error: {
          code: 'ACCOUNT_DEACTIVATED',
          message: 'Account has been deactivated',
          details: {}
        }
      });
    }

    // Prevent session fixation: issue a fresh session ID upon successful auth
    req.session.regenerate((regenErr) => {
      if (regenErr) {
        console.error('Session regenerate error:', regenErr);
        return res.status(500).json({
          error: {
            code: 'SESSION_ERROR',
            message: 'Failed to create session',
            details: {}
          }
        });
      }

      // Set session data
      req.session.userId = user.id;

      // Save session
      req.session.save(async (err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({
            error: {
              code: 'SESSION_ERROR',
              message: 'Failed to create session',
              details: {}
            }
          });
        }

        // Record in Session DB table for tracking/audit
        await sessionService.createSession(
          req.session.id,
          user.id,
          req.ip,
          req.get('User-Agent')
        );

        // Return user info
        const userInfo = {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          role: user.role.name,
          department: user.department ? user.department.name : null
        };

        res.json({
          success: true,
          data: {
            user: userInfo
          }
        });
      });
    });
  } catch (error) {
    // Expected authentication failures: log a single line, never a stack trace or password.
    if (error.status === 401 || error.name === 'AdAuthError' || error.code === 'INVALID_CREDENTIALS') {
      console.warn(`[AUTH] Login rejected for '${(req.body?.username || '').trim().toLowerCase()}': ${error.message}`);
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: error.message || 'Invalid username or password',
          details: {}
        }
      });
    }

    // Distinguish AD unreachable (502) from internal errors.
    if (error.status === 502 || error.name === 'AdUnreachableError' || error.code === 'AD_UNREACHABLE') {
      console.error('[AUTH] Active Directory unreachable:', error.message);
      return res.status(502).json({
        error: {
          code: 'AD_UNREACHABLE',
          message: 'Could not reach Active Directory',
          details: {}
        }
      });
    }

    console.error('Login error:', error);

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during login',
        details: {}
      }
    });
  }
};

/**
 * Logout endpoint
 * @route POST /api/auth/logout
 */
exports.logout = async (req, res) => {
  try {
    const sessionId = req.session?.id;

    if (sessionId) {
      await sessionService.destroySession(sessionId);
    }

    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destroy error:', err);
        }
        res.clearCookie('connect.sid');
        return res.json({
          success: true,
          message: 'Logged out successfully'
        });
      });
    } else {
      res.clearCookie('connect.sid');
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during logout',
        details: {}
      }
    });
  }
};

/**
 * Get current user
 * @route GET /api/auth/me
 */
exports.me = async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
          details: {}
        }
      });
    }

    const user = await authService.getUserById(req.session.userId);

    if (!user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not found',
          details: {}
        }
      });
    }

    const userInfo = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role.name,
      department: user.department ? user.department.name : null
    };

    res.json({
      success: true,
      data: userInfo
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching user info',
        details: {}
      }
    });
  }
};

/**
 * Check Active Directory reachability / status
 * @route GET /api/auth/ad-status
 */
exports.adStatus = async (req, res) => {
  try {
    const status = await adService.checkAdReachability();
    res.json({
      success: true,
      data: {
        ...status,
        authMode: 'ad'
      }
    });
  } catch (error) {
    console.error('[AUTH CONTROLLER] adStatus error:', error);
    res.status(500).json({
      error: {
        code: 'CHECK_FAILED',
        message: 'Failed to probe Active Directory status',
        details: { message: error.message }
      }
    });
  }
};