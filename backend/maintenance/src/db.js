// Single shared Prisma client for the Maintenance module.
// Generated from maintenance/prisma/schema.prisma (separate `maintenance` database).
const path = require('path');
// Load the backend env (no-op when the host process already loaded it).
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { PrismaClient } = require('../generated/client');

const prisma = new PrismaClient();

module.exports = prisma;
