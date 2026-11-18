const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database('./data/maintenance.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the maintenance database.');
});

const schema = `
DROP TABLE IF EXISTS "request_attachments";
DROP TABLE IF EXISTS "request_spare_parts";
DROP TABLE IF EXISTS "request_comments";
DROP TABLE IF EXISTS "request_assignments";
DROP TABLE IF EXISTS "audit_logs";
DROP TABLE IF EXISTS "notifications";
DROP TABLE IF EXISTS "maintenance_requests";
DROP TABLE IF EXISTS "users";
DROP TABLE IF EXISTS "roles";
DROP TABLE IF EXISTS "departments";
DROP TABLE IF EXISTS "maintenance_categories";
DROP TABLE IF EXISTS "sessions";

CREATE TABLE "roles" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL UNIQUE,
  "description" TEXT
);

CREATE TABLE "departments" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL UNIQUE
);

CREATE TABLE "maintenance_categories" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL UNIQUE
);

CREATE TABLE "users" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "username" TEXT NOT NULL UNIQUE,
  "displayName" TEXT,
  "email" TEXT,
  "departmentId" INTEGER,
  "roleId" INTEGER NOT NULL,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "lastLoginAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("departmentId") REFERENCES "departments" ("id"),
  FOREIGN KEY ("roleId") REFERENCES "roles" ("id")
);

CREATE TABLE "maintenance_requests" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "ticketNumber" TEXT NOT NULL UNIQUE,
  "requesterId" INTEGER NOT NULL,
  "departmentId" INTEGER,
  "categoryId" INTEGER NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'Normal',
  "description" TEXT NOT NULL,
  "location" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "receivedById" INTEGER,
  "receivedAt" DATETIME,
  "assignedToId" INTEGER,
  "assignedById" INTEGER,
  "assignedAt" DATETIME,
  "startedById" INTEGER,
  "startedAt" DATETIME,
  "actionTaken" TEXT,
  "maintenanceTime" INTEGER,     -- in minutes
  "completedById" INTEGER,
  "completedAt" DATETIME,
  "finalReport" TEXT,
  "rejectionReason" TEXT,
  "rejectedById" INTEGER,
  "rejectedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("requesterId") REFERENCES "users" ("id"),
  FOREIGN KEY ("departmentId") REFERENCES "departments" ("id"),
  FOREIGN KEY ("categoryId") REFERENCES "maintenance_categories" ("id"),
  FOREIGN KEY ("receivedById") REFERENCES "users" ("id"),
  FOREIGN KEY ("assignedToId") REFERENCES "users" ("id"),
  FOREIGN KEY ("assignedById") REFERENCES "users" ("id"),
  FOREIGN KEY ("startedById") REFERENCES "users" ("id"),
  FOREIGN KEY ("completedById") REFERENCES "users" ("id"),
  FOREIGN KEY ("rejectedById") REFERENCES "users" ("id")
);

CREATE TABLE "request_assignments" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "requestId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "assignedById" INTEGER NOT NULL,
  "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("requestId") REFERENCES "maintenance_requests" ("id"),
  FOREIGN KEY ("userId") REFERENCES "users" ("id"),
  FOREIGN KEY ("assignedById") REFERENCES "users" ("id"),
  UNIQUE ("requestId", "userId")
);

CREATE TABLE "request_comments" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "requestId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "comment" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("requestId") REFERENCES "maintenance_requests" ("id"),
  FOREIGN KEY ("userId") REFERENCES "users" ("id")
);

CREATE TABLE "request_spare_parts" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "requestId" INTEGER NOT NULL,
  "partName" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "requestedById" INTEGER NOT NULL,
  "releasedById" INTEGER,
  "releasedAt" DATETIME,
  "notes" TEXT,
  FOREIGN KEY ("requestId") REFERENCES "maintenance_requests" ("id"),
  FOREIGN KEY ("requestedById") REFERENCES "users" ("id"),
  FOREIGN KEY ("releasedById") REFERENCES "users" ("id")
);

CREATE TABLE "request_attachments" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "requestId" INTEGER NOT NULL,
  "fileName" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("requestId") REFERENCES "maintenance_requests" ("id")
);

CREATE TABLE "notifications" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "requestId" INTEGER NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "sentAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("requestId") REFERENCES "maintenance_requests" ("id")
);

CREATE TABLE "audit_logs" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "requestId" INTEGER,
  "userId" INTEGER,
  "action" TEXT NOT NULL,
  "details" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("requestId") REFERENCES "maintenance_requests" ("id"),
  FOREIGN KEY ("userId") REFERENCES "users" ("id")
);

CREATE TABLE "sessions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" DATETIME NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "users" ("id")
);

`;

db.exec(schema, (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log('Database schema created successfully.');
  }
  db.close();
});