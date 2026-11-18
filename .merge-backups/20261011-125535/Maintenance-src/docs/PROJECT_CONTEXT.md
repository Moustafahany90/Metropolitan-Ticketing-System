# Metropolitan School Maintenance Management System

## Project Name
Metropolitan School Maintenance Management System

## Purpose
Replace the school's existing paper-based Maintenance Form with an internal web-based Maintenance Request / Ticketing System.

## Environment
- Domain: `metschool.local`
- Domain Controller: `ADD-DC.metschool.local`
- LDAP Protocol: LDAP on port 389
- Base DN: `DC=metschool,DC=local`
- User Search Base: `DC=metschool,DC=local`
- User Login Attribute: `sAMAccountName`
- School email domain: `metropolitanschool.edu.eg`
- Microsoft 365 / Entra ID: AVAILABLE
- Tenant ID: `d89c1482-0f83-4200-b4ea-a4fafb6bca25`
- Shared Mailbox: `maintenance@metropolitanschool.edu.eg`
- School timezone: `Africa/Cairo`

## Technology Stack
- Frontend: React, Vite, Tailwind CSS, React Router, Axios
- Backend: Node.js + Express.js
- Database: SQLite + Prisma ORM
- Authentication: Active Directory/LDAP
- Notifications: Microsoft Graph API
- Session: Server-side sessions with HTTP-only cookies (SQLite-backed)

## Architecture
Modular monolith architecture with separation of concerns:
- Frontend: Role-based routing, responsive design
- Backend: RESTful API with services for Auth, LDAP, Requests, Assignments, Notifications, Audit, Users
- Database: Simple normalized schema with tables for users, roles, departments, categories, requests, assignments, comments, spare parts, attachments, notifications, audit logs
- Authentication: AD/LDAP integration without service account using user credentials for binding
- Authorization: Application-level RBAC (roles: EMPLOYEE, SUPERVISOR, MAINTENANCE_WORKER, STORE_KEEPER, ADMIN)
- Workflow: SUBMITTED → ASSIGNED → IN_PROGRESS → COMPLETED (with optional REJECTED)

## Database Approach
SQLite with Prisma ORM for simplicity and easy deployment on Windows Server.
Tables designed to mirror the paper form workflow while normalizing data.

## Roles
Application-level roles (not AD groups):
- EMPLOYEE: Default role, can create and track own requests
- SUPERVISOR: Can review and assign requests
- MAINTENANCE_WORKER: Can execute maintenance work
- STORE_KEEPER: Can manage spare parts
- ADMIN: Full system access

## Workflow
1. Employee creates request → SUBMITTED (notify supervisor)
2. Supervisor assigns worker → ASSIGNED (notify worker)
3. Worker starts work → IN_PROGRESS
4. Worker completes work → COMPLETED (notify employee)
Optional rejection path available.

## Deployment Environment
Windows Server running on school LAN:
- Employee Browser → School LAN/WiFi → Windows Server → Node.js Application → SQLite
- Microsoft Graph for email notifications (requires internet)
- Active Directory for authentication

## Important Constraints
- Do not invent AD infrastructure details
- Do not assume AD groups exist for application roles
- Do not hard-code credentials or secrets
- Use environment variables for configuration
- Never store AD passwords or Microsoft 365 secrets in code/logs
- LDAP implementation must work without a service account
- Application roles stored in database, not AD
- Ticket numbers: MNT-XXXXXX format, globally sequential, never reset
- Email failure must not cause request transaction to fail
- Responsive UI for desktop, tablet, mobile
- English language only
- Do not over-engineer (no microservices, Kubernetes, etc. for MVP)