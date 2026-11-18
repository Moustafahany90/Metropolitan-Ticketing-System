const express = require('express');
const cors = require('cors');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const authRoutes = require('./src/routes/auth');
const requestRoutes = require('./src/routes/request');
const { seedCategoriesAndDepartments } = require('./seed-categories');

// Seed default categories and departments on startup
seedCategoriesAndDepartments().catch((err) => console.error('[STARTUP] Seeding error:', err));

const app = express();
const PORT = process.env.PORT || 3001;

/**
 * Validate authentication configuration at startup.
 * Fails closed: in production, misconfiguration aborts startup rather than
 * falling back to any non-AD mode.
 */
function validateAuthConfig() {
  const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
  const authMode = (process.env.AUTH_MODE || 'ad').toLowerCase();
  const isProduction = nodeEnv === 'production';

  if (isProduction && authMode !== 'ad') {
    throw new Error('[STARTUP] AUTH_MODE must be "ad" in production. Local/mock authentication is not permitted.');
  }
  if (isProduction && (process.env.MOCK_AUTH || '').toLowerCase() === 'true') {
    throw new Error('[STARTUP] MOCK_AUTH is not permitted in production.');
  }
  if (authMode !== 'ad') {
    console.warn(`[STARTUP] AUTH_MODE="${authMode}" is not supported; Active Directory is always enforced.`);
  }

  const required = ['AD_URL', 'AD_DOMAIN', 'AD_BASE_DN'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    const message = `[STARTUP] Missing required Active Directory configuration: ${missing.join(', ')}`;
    if (isProduction) {
      throw new Error(message);
    }
    console.warn(`${message} — authentication will fail closed until configured.`);
  }

  const adUrl = (process.env.AD_URL || '').toLowerCase();
  const startTls = (process.env.AD_STARTTLS || '').toLowerCase() === 'true';
  if (adUrl.startsWith('ldap://') && !startTls) {
    console.warn('[SECURITY] AD_URL uses cleartext ldap:// without StartTLS; credentials travel unencrypted. Use ldaps:// (port 636) or set AD_STARTTLS=true if the domain controller supports it.');
  }
}

validateAuthConfig();

// Ensure data directory exists for SQLite session store
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Enable CORS for frontend client
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or same-origin)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive in development
  },
  credentials: true
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: dataDir
  }),
  secret: process.env.SESSION_SECRET || 'metropolitan-school-maintenance-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true for HTTPS in production
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: parseInt(process.env.SESSION_MAX_AGE, 10) || (8 * 60 * 60 * 1000) // 8 hours default
  }
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('/api', (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'API route not found'
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err.stack || err);
  res.status(err.status || 500).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Something went wrong!',
      details: process.env.NODE_ENV === 'development' ? err.stack : {}
    }
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`[SERVER] Running on http://localhost:${PORT}`);
  console.log(`[AUTH] Mode: ACTIVE DIRECTORY (ldapts direct bind) at ${process.env.AD_URL || 'ldap://ADD-DC.metschool.local'}`);
});


module.exports = { app, server };