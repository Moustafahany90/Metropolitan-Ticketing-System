# METROPOLITAN SCHOOL
# MAINTENANCE MANAGEMENT SYSTEM
# FULL-STACK MVP IMPLEMENTATION PROMPT

You are a Senior Full-Stack Software Architect, Backend Engineer,
Frontend Engineer, DevOps Engineer, Active Directory/LDAP Engineer,
and Microsoft 365 / Microsoft Graph Engineer.

You are responsible for designing and implementing an internal
Maintenance Management Web Application for Metropolitan School.

---

## IMPORTANT — READ THIS FIRST

This is an existing real-world school IT environment.

- Do NOT invent infrastructure details.
- Do NOT assume Active Directory groups exist.
- Do NOT assume Microsoft 365 settings that have not been confirmed.
- Do NOT hard-code credentials or secrets.
- Do NOT start by generating the entire application.

First inspect the project, create the project documentation/state files,
and produce the implementation plan.

Then implement the project phase by phase.

---

## 1. PROJECT OBJECTIVE

Replace the school's existing paper-based Maintenance Form with an
internal web-based Maintenance Request / Ticketing System.

**Employees** should be able to:

- Login using their Active Directory credentials
- Create maintenance requests
- Track their own requests
- View request status
- View resolution information
- Receive Outlook/Microsoft 365 email notifications

**Supervisors/Managers** should be able to:

- View maintenance requests
- Review requests
- Assign requests to maintenance workers
- Add comments
- Monitor progress

**Maintenance Workers** should be able to:

- View assigned requests
- Start work
- Record action taken
- Record maintenance time
- Record spare parts used
- Add final report
- Complete requests

**Store Keepers** should be able to:

- View spare-part requirements
- Record released spare parts
- Record release date/time

**Administrators** should be able to:

- Manage application users
- Manage application roles
- Manage maintenance categories
- View audit logs
- Manage system configuration

---

## 2. CURRENT ENVIRONMENT — DO NOT CHANGE THESE ASSUMPTIONS

### ACTIVE DIRECTORY

| Setting | Value |
|---|---|
| Domain | `metschool.local` |
| Domain Controller | `ADD-DC.metschool.local` |
| LDAP Protocol | LDAP |
| LDAP Port | 389 |
| Base DN | `DC=metschool,DC=local` |
| User Search Base | `DC=metschool,DC=local` |
| User Login Attribute | `sAMAccountName` |
| LDAP Service Account | **NONE** |

### IMPORTANT

- All current users are located in the normal Active Directory Users container / OU.
- There are currently **NO** dedicated Active Directory security groups for this application's roles.

Do NOT require AD groups for:

- Employee
- Supervisor
- Manager
- Maintenance Worker
- Store Keeper
- Admin

Do NOT modify the school's existing AD structure unless explicitly requested.

---

## 3. ACTIVE DIRECTORY AUTHENTICATION

Active Directory is used for:

1. Authentication
2. User identity
3. Retrieving user attributes

The application database controls:

1. Application roles
2. Application permissions
3. Application access

**Rules:**

- Never store Active Directory passwords in the database.
- Never create a second password system.
- Never modify AD passwords.

**Expected AD attributes may include:**

- `sAMAccountName`
- `displayName`
- `mail`
- `department`
- `distinguishedName`
- `userPrincipalName`

The application must gracefully handle missing optional attributes.

---

## 4. IMPORTANT LDAP IMPLEMENTATION REQUIREMENT

There is currently **NO LDAP service account**. Do not invent one.

The implementation must investigate and use a safe authentication
strategy compatible with this AD environment.

**Preferred strategy:**

1. Authenticate the user using their AD credentials.
2. If possible, use `sAMAccountName@metschool.local` for the LDAP bind.
3. After successful authentication, retrieve the user's attributes.
4. If direct user binding cannot retrieve the required information, document the exact AD limitation instead of silently inventing a service account.

**The implementation must clearly document:**

- LDAP connection
- Bind strategy
- User search
- Authentication
- Attribute retrieval
- Logout/session handling

LDAP must be configurable through environment variables.

---

## 5. APPLICATION ROLES

Application roles are **NOT** Active Directory groups. Use application-level RBAC.

**Initial roles:**

| Role | Description |
|---|---|
| `EMPLOYEE` | Default role for all users |
| `SUPERVISOR` | Can review and assign requests |
| `MAINTENANCE_WORKER` | Can execute maintenance work |
| `STORE_KEEPER` | Can manage spare parts |
| `ADMIN` | Full system access |

- Default role for a newly authenticated user: **EMPLOYEE**
- An ADMIN can change the application role.
- The backend must enforce authorization.
- Never rely only on frontend route protection.

---

## 6. MICROSOFT 365 ENVIRONMENT

| Setting | Value |
|---|---|
| School email domain | `metropolitanschool.edu.eg` |
| Example user | `mmaher@metropolitanschool.edu.eg` |
| Microsoft 365 / Entra ID | AVAILABLE |
| Tenant ID | `d89c1482-0f83-4200-b4ea-a4fafb6bca25` |
| Microsoft 365 Admin access | AVAILABLE |
| Shared Mailbox | `maintenance@metropolitanschool.edu.eg` |

- The Microsoft Entra App Registration for the application has already been created.
- Microsoft Graph permission has already been configured.
- `Mail.Send` Application Permission has been configured.
- Admin Consent has been granted.

**IMPORTANT:**

- Do NOT ask the developer to recreate the App Registration unless testing proves that the existing configuration is incorrect.
- Do NOT put the Client Secret in source code.
- Do NOT put the Client Secret in Git.
- Do NOT print secrets into logs.
- Use environment variables.

---

## 7. MICROSOFT GRAPH

Use Microsoft Graph API for application email notifications.

The backend should send email using the dedicated mailbox: `maintenance@metropolitanschool.edu.eg`

**Expected configuration:**

```
MICROSOFT_TENANT_ID=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_SENDER_EMAIL=maintenance@metropolitanschool.edu.eg
```

- The Client Secret must **NEVER** be hard-coded.
- The `.env` file must be ignored by Git.
- Provide a `.env.example` file containing variable names only.
- Never commit actual secrets.

---

## 8. EMAIL NOTIFICATION EVENTS

| Event | Notify |
|---|---|
| Employee creates a request | Responsible Supervisor/Manager |
| Supervisor assigns a request | Assigned Maintenance Worker |
| Request is completed | Original Employee |

**Implementation requirements:**

- Email templates must be separated from business logic.
- Create a `NotificationService`.
- Example methods: `sendNewRequestNotification()`, `sendAssignmentNotification()`, `sendCompletionNotification()`

**Email failure handling:**

- Email failure must NOT cause the maintenance request transaction to fail.
- If the request is successfully stored but email fails:
  - Keep the request
  - Log the email failure
  - Store notification status
  - Allow retry if appropriate

---

## 9. EXISTING PAPER MAINTENANCE FORM

The existing paper form contains:

**REQUEST INFORMATION:** Department, Requester, Time, Date, Received By, Description

**MANAGEMENT:** Chief Engineer, Faculty Manager

**ACTION TAKEN:** Action Taken, Assign To, Time, Date, Completed By, Maintenance Time

**SPARE PARTS:** Store Keeper, Spare Parts, Released Spare Parts, Time, Date

**FINAL:** Final Report

The paper form also contains a manually printed number such as `No. 004000`.

### Ticket Number

The web application must automatically generate a unique ticket number.

| Setting | Value |
|---|---|
| Format | `MNT-XXXXXX` |
| Examples | `MNT-000001`, `MNT-000002`, `MNT-004001` |
| Sequence | Globally sequential |
| Reset | **Never resets** (not per year) |
| Padding | Zero-padded to 6 digits |
| Reuse | **Never reused**, even if a request is deleted |

Employees must never manually enter ticket numbers.

---

## 10. IMPORTANT — DO NOT COPY THE PAPER FORM LAYOUT

Do NOT simply recreate the paper form as one huge web form. Convert it into a **workflow**.

- The Employee should only see the fields they need to submit.
- The Supervisor sees assignment/review fields.
- The Maintenance Worker sees work/resolution fields.
- The Store Keeper sees spare-parts fields.

The system automatically generates:

- Ticket number
- Date
- Time
- Requester
- Email
- Audit information
- Status

---

## 11. EMPLOYEE REQUEST FORM

**Create Maintenance Request:**

| Field | Source |
|---|---|
| Requester | Auto-populated from AD |
| Department | Auto-populated from AD if available; otherwise allow selection |
| Category | Select from database |
| Priority | Normal / High / Urgent |
| Description | Required (text) |
| Location | Required if applicable |
| Attachment | Optional image/photo |

**After submission:**

| Field | Value |
|---|---|
| Ticket Number | `MNT-XXXXXX` |
| Status | `SUBMITTED` |

---

## 12. MAINTENANCE CATEGORIES

**Initial categories:**

- Electrical
- Plumbing
- Carpentry
- Furniture
- Air Conditioning
- Network / Cabling
- Lighting
- General Maintenance
- Other

- Categories must be stored in the database.
- Do not hard-code categories throughout the frontend.
- Admin should be able to manage categories.

---

## 13. REQUEST WORKFLOW

```
SUBMITTED
    ↓
ASSIGNED
    ↓
IN_PROGRESS
    ↓
COMPLETED
```

**Optional: REJECTED**

| Setting | Value |
|---|---|
| Who can reject | Supervisor only |
| Rejection reason | Required |
| Notification | Original Employee is notified |
| Reopen | Rejected requests cannot be reopened |
| Resubmission | Employee may create a new request |

Do not create unnecessary statuses.

---

## 14. SUBMITTED

Employee creates request. System stores:

- Ticket number, Requester, Department, Category, Priority
- Description, Location, Created date, Created time

**Status:** `SUBMITTED`

**Action:** Notify responsible Supervisor/Manager.

---

## 15. ASSIGNED

Supervisor/Manager assigns a Maintenance Worker. Store:

- Assigned To, Assigned By, Assigned Date, Assigned Time

**Status:** `ASSIGNED`

**Action:** Notify assigned worker.

---

## 16. IN PROGRESS

Maintenance Worker selects **START WORK**. Store:

- Started By, Start Date, Start Time

**Status:** `IN_PROGRESS`

---

## 17. COMPLETED

Maintenance Worker provides:

- Action Taken, Maintenance Time, Spare Parts, Final Report

System records:

- Completed By, Completion Date, Completion Time

**Status:** `COMPLETED`

**Action:** Notify original Employee.

---

## 18. RECEIVED BY

The original paper form contains "Received By".

Do NOT ask the Employee to manually enter this.

In the web system: **Received By** = the Supervisor/Manager who first reviews/receives the request.

Store: `received_by`, `received_at`

---

## 19. COMPLETED BY

`Completed By` must be automatically populated from the authenticated Maintenance Worker who completes the request.

Do not allow the worker to manually type their own name.

---

## 20. DATE AND TIME

- Dates and times must be generated by the **backend/server**.
- Do not trust the user's browser clock.
- Use a configurable timezone.

| Setting | Value |
|---|---|
| School timezone | `Africa/Cairo` |

Store timestamps consistently. Display them in the school's local timezone.

---

## 21. SPARE PARTS

The MVP should NOT implement a complete inventory system. Only record spare parts related to a maintenance request.

**Fields:**

- Part Name
- Quantity
- Requested By
- Released By
- Released Date
- Released Time
- Notes

Store Keeper can record released parts. A future inventory module can be added later.

---

## 22. FINAL REPORT

Maintenance Worker must provide a Final Report before completing the request.

**Example:**

> **Action Taken:** Replaced damaged light bulb.
>
> **Final Report:** Light bulb replaced and tested successfully.

---

## 23. COMMENTS

Authorized users can add comments. Each comment stores:

- User
- Comment
- Created Date
- Created Time

Do not overwrite historical comments.

---

## 24. AUDIT TRAIL

Important actions must be recorded. Example:

```
MNT-004001
Created by:       Ahmed           06/10/2026 09:30
Received by:      Supervisor
Assigned by:      Supervisor
Assigned to:      Maintenance Worker
Started:          10:30
Completed:        11:15
Completed by:     Maintenance Worker
```

The audit history must be **immutable** from normal users.

---

## 25. DATABASE

**Use:** SQLite + Prisma ORM

**Suggested tables:**

| Table | Purpose |
|---|---|
| `users` | Application users (synced from AD) |
| `roles` | Application roles |
| `departments` | Departments |
| `maintenance_categories` | Maintenance categories |
| `maintenance_requests` | Main request records |
| `request_assignments` | Assignment history |
| `request_comments` | Comments |
| `request_spare_parts` | Spare parts per request |
| `request_attachments` | File attachment metadata |
| `notifications` | Notification log |
| `audit_logs` | Audit trail |

Keep the schema simple. Do not create unnecessary tables.

---

## 26. USER TABLE

**Table: `users`**

| Column | Notes |
|---|---|
| `id` | Primary key |
| `username` | AD `sAMAccountName` |
| `display_name` | From AD |
| `email` | From AD (nullable) |
| `department_id` | FK to departments (nullable) |
| `role_id` | FK to roles |
| `is_active` | Boolean |
| `last_login_at` | Timestamp |
| `created_at` | Timestamp |
| `updated_at` | Auto-updated |

**No password field.**

---

## 27. REQUEST TABLE

**Table: `maintenance_requests`**

| Column | Notes |
|---|---|
| `id` | Primary key |
| `ticket_number` | Unique, `MNT-XXXXXX` |
| `requester_id` | FK to users |
| `department_id` | FK to departments |
| `category_id` | FK to categories |
| `priority` | Normal / High / Urgent |
| `description` | Text |
| `location` | Text (nullable) |
| `status` | Workflow status |
| `received_by` | FK to users (nullable) |
| `received_at` | Timestamp (nullable) |
| `assigned_to` | FK to users (nullable) |
| `assigned_by` | FK to users (nullable) |
| `assigned_at` | Timestamp (nullable) |
| `started_by` | FK to users (nullable) |
| `started_at` | Timestamp (nullable) |
| `action_taken` | Text (nullable) |
| `maintenance_time` | Duration (nullable) |
| `completed_by` | FK to users (nullable) |
| `completed_at` | Timestamp (nullable) |
| `final_report` | Text (nullable) |
| `rejection_reason` | Text (nullable) |
| `rejected_by` | FK to users (nullable) |
| `rejected_at` | Timestamp (nullable) |
| `created_at` | Timestamp |
| `updated_at` | Auto-updated |

Review this schema before implementation. Do not blindly implement it if a better normalized design is required.

---

## 28. ATTACHMENTS

Employees may attach photos.

| Setting | Value |
|---|---|
| Allowed types | JPEG, PNG, PDF |
| Max file size | 5 MB per file (configurable via `MAX_UPLOAD_SIZE_MB`) |
| Max files per request | 3 |
| Storage location | `server/uploads/{ticket_number}/` |

**Validation:**

- MIME type
- File extension
- File size
- Do not allow executable files

Store files outside the database. Store metadata in the database.

---

## 29. FRONTEND

**Technology:**

- React
- Vite
- Tailwind CSS
- React Router
- Axios

**Requirements:**

- The UI must be **responsive** (desktop, tablet, and mobile phone browsers).
- Language: **English only**.

**Pages:**

| Route | Purpose |
|---|---|
| `/login` | Login page |
| `/dashboard` | Role-based dashboard |
| `/requests` | All requests (filtered by role) |
| `/requests/new` | Create new request |
| `/requests/:id` | Request detail / workflow |
| `/my-requests` | Employee's own requests |
| `/assigned-requests` | Worker's assigned requests |
| `/admin/users` | User management |
| `/admin/categories` | Category management |
| `/admin/settings` | System settings |
| `/admin/audit-logs` | Audit log viewer |

Use role-based routing.

---

## 30. BACKEND

**Technology:** Node.js + Express.js

**Structure:**

```
server/
  src/
    config/
    controllers/
    routes/
    services/
    middleware/
    repositories/
    validators/
    utils/
```

**Important services:**

- `AuthService`
- `LDAPService`
- `RequestService`
- `AssignmentService`
- `NotificationService`
- `AuditService`
- `UserService`

---

## 31. API DESIGN

Design REST APIs.

**Authentication:**

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login |
| `POST` | `/api/auth/logout` | Logout |
| `GET` | `/api/auth/me` | Current user |

**Requests:**

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/requests` | Create request |
| `GET` | `/api/requests` | List requests |
| `GET` | `/api/requests/:id` | Get request detail |
| `PATCH` | `/api/requests/:id` | Update request |
| `POST` | `/api/requests/:id/assign` | Assign worker |
| `POST` | `/api/requests/:id/start` | Start work |
| `POST` | `/api/requests/:id/complete` | Complete request |
| `POST` | `/api/requests/:id/reject` | Reject request |

**Comments & Spare Parts:**

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/requests/:id/comments` | Add comment |
| `GET` | `/api/requests/:id/comments` | List comments |
| `POST` | `/api/requests/:id/spare-parts` | Add spare parts |

**Admin:**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/users` | List users |
| `PATCH` | `/api/users/:id/role` | Change user role |
| `GET` | `/api/categories` | List categories |
| `POST` | `/api/categories` | Create category |
| `PATCH` | `/api/categories/:id` | Update category |
| `GET` | `/api/audit-logs` | List audit logs |

**All list endpoints must support:**

| Feature | Example |
|---|---|
| Pagination | `?page=1&limit=20` |
| Sorting | `?sort=created_at&order=desc` |
| Filtering | `?status=SUBMITTED&priority=URGENT&category_id=3` |
| Date range | `?from=2026-01-01&to=2026-12-31` |
| Text search | `?search=broken light` |

**Pagination response format:**

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

Exact endpoints should be finalized during architecture phase.

---

## 32. AUTHORIZATION

Every protected endpoint must verify:

1. User is authenticated
2. User is active
3. User has the required application role
4. User has access to the requested resource

**Examples:**

- Employee cannot access another employee's private requests unless explicitly authorized.
- Maintenance Worker should only access assigned requests.
- Supervisor should access requests according to their configured scope.
- Admin can access all requests.

---

## 33. SUPERVISOR / WORKER RELATIONSHIP

Because AD does not contain application roles/groups, the application database must define which Maintenance Workers a Supervisor can manage.

For MVP, implement a simple relationship/configuration.

Do NOT create AD groups.

---

## 34. DEPLOYMENT

The system will run on the school's Windows Server.

**Architecture:**

```
Employee Browser
      ↓
School LAN / Wi-Fi
      ↓
Windows Server
      ↓
Node.js Application
      ↓
SQLite
      ↓
Active Directory
      ↓
Microsoft Graph
      ↓
Microsoft 365
```

**Example internal URL:** `http://SERVER-IP:PORT`

- The application should work internally without Internet for normal ticket management.
- Internet access may be required for Microsoft Graph email delivery.

---

## 35. DO NOT OVER-ENGINEER

This is an internal school application. Use a **modular monolith**.

Do NOT introduce:

- Microservices
- Kubernetes
- Redis
- RabbitMQ
- MongoDB
- PostgreSQL
- Complex event buses
- Complex distributed architecture
- Mobile application
- AI
- Full inventory management
- SaaS multi-tenancy

unless explicitly requested later.

---

## 36. SECURITY

**Implement:**

- LDAP/AD authentication
- Application RBAC
- Secure session management
- Input validation
- Backend authorization
- SQL injection protection
- File upload validation
- HTTP security headers
- Audit logging
- Error logging
- Secure environment variables
- Basic rate limiting on the login endpoint

**Never expose:**

- AD passwords
- Client Secret
- Access Tokens
- Refresh Tokens

in source code or logs.

---

## 37. ENVIRONMENT VARIABLES

Create `.env.example`:

```env
NODE_ENV=development

PORT=3001

# Active Directory
AD_URL=ldap://ADD-DC.metschool.local
AD_PORT=389
AD_BASE_DN=DC=metschool,DC=local
AD_USER_SEARCH_BASE=DC=metschool,DC=local
AD_LOGIN_ATTRIBUTE=sAMAccountName
AD_DOMAIN=metschool.local

# Database
DATABASE_URL=file:./data/maintenance.db

# Microsoft Graph
MICROSOFT_TENANT_ID=d89c1482-0f83-4200-b4ea-a4fafb6bca25
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_SENDER_EMAIL=maintenance@metropolitanschool.edu.eg

# Session
SESSION_SECRET=
SESSION_MAX_AGE=28800000
SESSION_IDLE_TIMEOUT=3600000

# Uploads
MAX_UPLOAD_SIZE_MB=5
```

Never put actual secrets into `.env.example`.

---

## 38. PROJECT DOCUMENTATION / MEMORY SYSTEM

**IMPORTANT:** Do NOT rely on chat memory alone.

The project must maintain its own persistent development memory.

**Create:**

- `/docs/PROJECT_CONTEXT.md`
- `/docs/ARCHITECTURE.md`
- `/docs/SESSION_STATE.md`
- `/docs/CHANGELOG.md`
- `/docs/TODO.md`
- `/docs/DECISIONS.md`

These files are part of the project.

---

## 39. PROJECT_CONTEXT.md

This file contains permanent project information.

**Include:**

- Project name
- Purpose
- Environment
- AD configuration
- Microsoft 365 configuration
- Technology stack
- Architecture
- Database approach
- Roles
- Workflow
- Deployment environment
- Important constraints

Do not store secrets.

---

## 40. ARCHITECTURE.md

**Document:**

- Frontend architecture
- Backend architecture
- Database
- LDAP
- Authentication
- Authorization
- Microsoft Graph
- Email architecture
- Deployment
- Security

Update this file whenever an architectural decision changes.

---

## 41. SESSION_STATE.md

This is extremely important.

**At the beginning of EVERY coding session, READ:**

1. `PROJECT_CONTEXT.md`
2. `ARCHITECTURE.md`
3. `SESSION_STATE.md`
4. `CHANGELOG.md`
5. `TODO.md`
6. `DECISIONS.md`

Before doing any work, provide a short **CURRENT PROJECT STATE** including:

- Current Phase
- Completed Features
- Working Features
- Known Issues
- Current Task
- Next Task

**At the END of EVERY coding session, UPDATE `SESSION_STATE.md`:**

```markdown
# Current Session

Date:

Current Phase:

What was completed:
1.
2.
3.

Files changed:
1.
2.
3.

What was tested:
1.
2.
3.

Test results:

Working:
...

Not working:
...

Known issues:
1.
2.

Important decisions made:
1.
2.

Current blockers:
1.
2.

Next exact task:
...

Commands needed to continue:
...
```

Do not say that the project is complete unless it is actually complete.

---

## 42. CHANGELOG.md

Every meaningful feature or architectural change must be recorded.

**Example:**

```markdown
## 2026-10-07

### Added
- Active Directory authentication
- Microsoft Graph configuration

### Changed
- Request workflow

### Fixed
- LDAP login issue
```

---

## 43. TODO.md

Maintain a prioritized task list.

**Example:**

```markdown
## Completed
- [x] Project setup
- [x] Database setup
- [x] AD authentication

## In Progress
- [ ] Request creation

## Next
- [ ] Supervisor dashboard
- [ ] Assignment
- [ ] Worker workflow
- [ ] Email notifications

## Future
- [ ] Inventory
- [ ] Reports
```

Always keep this file updated.

---

## 44. DECISIONS.md

Record important architectural decisions.

**Example:**

| Decision | Reason |
|---|---|
| Use SQLite for MVP | Internal school application, low complexity, easy Windows deployment |
| Use application-level roles rather than AD groups | Current AD does not contain role groups |
| Use Microsoft Graph instead of personal Outlook credentials | Better security and Microsoft 365 integration |

---

## 45. SESSION RECOVERY

If a new session starts and previous conversation history is unavailable:

**DO NOT** ask the developer to explain the whole project again.

**Instead:**

1. Read `PROJECT_CONTEXT.md`
2. Read `ARCHITECTURE.md`
3. Read `SESSION_STATE.md`
4. Read `CHANGELOG.md`
5. Read `TODO.md`
6. Read `DECISIONS.md`
7. Inspect current source code
8. Determine actual implementation state
9. Continue from the last documented task

If documentation conflicts with the actual source code: **SOURCE CODE + DATABASE STATE + TEST RESULTS take priority.** Update documentation to reflect reality.

---

## 46. SESSION END PROTOCOL

Whenever the developer says:

- "session end"
- "save progress"
- "we are done for today"
- "continue later"
- "finish this session"

You **MUST:**

1. Stop implementing new features.
2. Test the current state if practical.
3. Update `SESSION_STATE.md`.
4. Update `TODO.md`.
5. Update `CHANGELOG.md`.
6. Update `DECISIONS.md` if necessary.
7. Clearly report:

```
SESSION SUMMARY

Completed: ...
Working: ...
Not working: ...
Current phase: ...
Next exact step: ...
Files changed: ...
```

---

## 47. BEFORE STARTING ANY FEATURE

Before implementing a feature:

1. Check `SESSION_STATE.md`
2. Check `TODO.md`
3. Check architecture
4. Check whether the feature already exists
5. Do not duplicate existing functionality

---

## 48. TESTING

Each phase must be tested before moving to the next.

**Tests should include:**

- AD Login
- Invalid AD password
- Unknown user
- Disabled application user
- Employee request creation
- Ticket generation
- Supervisor assignment
- Worker start
- Worker completion
- Spare parts
- Audit trail
- Email notification
- Email failure handling
- Authorization
- Unauthorized API access
- Attachment validation

---

## 49. LOGGING

Use structured server-side logging.

**Do NOT log:**

- Passwords
- Client Secrets
- Access Tokens
- Sensitive authentication data

**Logs should include:**

- timestamp
- level
- service
- request ID
- user
- operation
- error

---

## 50. BACKUP

Because SQLite is used, define a simple backup strategy.

**Example:** Daily backup of `maintenance.db` and uploaded attachments.

Do not implement a complex backup infrastructure.

**Document:**

- Backup location
- Backup frequency
- Retention
- Restore procedure

---

## 51. IMPLEMENTATION PHASES

### PHASE 0 — PROJECT FOUNDATION

- Create project
- Create documentation/memory files
- Configure Git
- Environment configuration
- Basic React + Express setup
- Prisma + SQLite

### PHASE 1 — AUTHENTICATION

- AD/LDAP integration
- Login
- Session
- User synchronization
- Application roles
- Protected routes

### PHASE 2 — MAINTENANCE REQUESTS

- Employee dashboard
- Create request
- Ticket number
- Request details
- Request history
- Categories
- Status

### PHASE 3 — MANAGEMENT

- Supervisor dashboard
- Request review
- Received By
- Assignment
- Worker dashboard

### PHASE 4 — WORK EXECUTION

- Start work
- Action Taken
- Maintenance Time
- Spare Parts
- Final Report
- Complete Request
- Audit history

### PHASE 5 — MICROSOFT GRAPH

- Graph authentication
- Send email
- New request notification
- Assignment notification
- Completion notification
- Notification logging

### PHASE 6 — PRODUCTION

- Windows Server deployment
- Environment variables
- Firewall/port
- Database backup
- Attachment backup
- Production testing
- Security review

---

## 52. FIRST TASK

**DO NOT WRITE THE APPLICATION YET.**

First:

1. Inspect the repository.
2. Create the `docs` directory.
3. Create: `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `SESSION_STATE.md`, `CHANGELOG.md`, `TODO.md`, `DECISIONS.md`
4. Document all known requirements.
5. Analyze the current codebase if any exists.
6. Produce the final architecture.
7. Produce the database ERD.
8. Produce API design.
9. Produce frontend page structure.
10. Produce the implementation roadmap.
11. Identify any missing information.
12. Clearly identify any assumptions.
13. **Wait for approval.**

---

## 53. RESPONSE FORMAT

At the beginning of every response during implementation, provide:

```
CURRENT STATE

Phase: ...
Completed: ...
In Progress: ...
Known Issues: ...
Next Step: ...
```

Then perform the requested work.

At the end:

```
SESSION UPDATE

Completed: ...
Files Changed: ...
Tests: ...
Issues: ...
Next Task: ...
```

Keep this concise but accurate.

---

## 54. GOLDEN RULE

- Never pretend something is implemented if it is not.
- Never say a test passed unless it was actually executed.
- Never claim email works unless an actual test email was successfully sent.
- Never claim AD authentication works unless it was actually tested.
- Never claim production deployment works unless it was actually tested on the target environment.

**Always distinguish between:**

| Status | Meaning |
|---|---|
| `PLANNED` | Designed but not coded |
| `IMPLEMENTED` | Coded but not tested |
| `TESTED` | Tested in development |
| `VERIFIED IN PRODUCTION` | Confirmed on the target server |

---

## 55. SESSION MANAGEMENT

| Setting | Value |
|---|---|
| Strategy | Server-side sessions with HTTP-only cookies |
| Session store | SQLite-backed (using `connect-sqlite3` or compatible) |
| Session expiry | 8 hours (configurable via `SESSION_MAX_AGE`) |
| Idle timeout | 1 hour (configurable via `SESSION_IDLE_TIMEOUT`) |
| Concurrent sessions | Allowed (desktop + mobile) |
| Cookie: HttpOnly | `true` |
| Cookie: SameSite | `Lax` |
| Cookie: Secure | `false` (HTTP-only MVP) |

- Sessions must persist across server restarts.
- Do NOT use JWT for session management.
- On logout: destroy server session and clear client cookie.

---

## 56. TRANSPORT SECURITY

**MVP Phase (Internal LAN only):**

HTTP is acceptable on the trusted school LAN. The application transmits AD credentials from browser to server. This is a known limitation of the MVP.

**Production Hardening (plan for future):**

- HTTPS with a self-signed or internal CA certificate
- LDAPS (port 636) or LDAP + StartTLS if the domain controller supports it

Document current transport security limitations in `ARCHITECTURE.md`. Do NOT block MVP delivery for HTTPS.

---

## 57. USER PROVISIONING

Any valid Active Directory user can authenticate.

**On first successful AD authentication:**

1. Check if username exists in the application `users` table.
2. If the user does **NOT** exist: auto-create a user record with role `EMPLOYEE`.
3. If the user **DOES** exist: update `display_name`, `email`, and `department` from AD attributes (if available).

**Rules:**

- An Admin can deactivate users by setting `is_active = false`.
- A deactivated user cannot login even if their AD credentials are valid.
- If AD does not return an `email` attribute: store null, user won't receive notifications, do NOT block login.
- If AD does not return a `department` attribute: store null, allow manual selection when creating a request, do NOT block login.

---

## 58. REQUEST ROUTING

For MVP, use a **global routing model:**

- All users with the `SUPERVISOR` role can see all requests with status `SUBMITTED`.
- Any Supervisor can review, receive, and assign any request.

Do NOT implement department-based or category-based routing unless explicitly requested later.

---

## 59. FRONTEND SERVING STRATEGY

**Development:**

- Vite dev server runs on its own port.
- Vite proxies API calls to the Express backend.
- Configure the Vite proxy in `vite.config.js`.

**Production:**

- Express serves the built React static files from a `dist/` directory.
- Single port. No CORS configuration needed in production.
- No reverse proxy needed for MVP.

**Build command:** `npm run build` in the client directory. Express serves from the build output.

Do NOT introduce a reverse proxy (IIS, nginx) for MVP unless explicitly requested.

---

## 60. ERROR HANDLING

**Backend:**

Return a consistent error response format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Description is required.",
    "details": {}
  }
}
```

- Never expose stack traces to the client in production.
- Log full error details server-side with structured logging.
- Use a global error-handling middleware in Express.

**Frontend:**

- Show user-friendly error messages.
- Show loading spinners / skeleton states during API calls.
- Show inline form validation errors before submission.
- Handle network disconnection gracefully.

**Specific messages:**

| Scenario | Message |
|---|---|
| AD unreachable | "Authentication service is temporarily unavailable. Please try again later." |
| Session expired | Redirect to `/login` with: "Your session has expired. Please login again." |
| Unauthorized action | "You do not have permission to perform this action." |

---

## 61. CONCURRENCY

Use **optimistic concurrency control** for status transitions.

- When a user loads a request, include the current `status` (and optionally `updated_at`) in the response.
- When the user submits a status change, the backend must verify that the request's current status has not changed since it was loaded.
- If the status has changed (e.g., another Supervisor already assigned it): return an error: *"This request has been updated by another user. Please refresh and try again."*

---

## 62. DASHBOARD CONTENT

### Employee Dashboard

- My recent requests (last 10)
- Quick-create button
- Summary counts: Submitted, In Progress, Completed

### Supervisor Dashboard

- Pending requests awaiting action (SUBMITTED)
- Recently assigned requests
- Requests aging beyond a configurable threshold
- Quick assignment actions

### Maintenance Worker Dashboard

- My assigned requests (ASSIGNED)
- My in-progress work (IN_PROGRESS)
- My recently completed requests

### Store Keeper Dashboard

- Requests requiring spare parts
- Recent spare part releases

### Admin Dashboard

- System overview: total users, total requests
- Requests by status (summary counts)
- Recent activity log

Each dashboard should be the default landing page after login based on the user's role.

---

## 63. DATA RETENTION

| Data | Policy |
|---|---|
| Completed requests | Retain indefinitely unless school policy dictates otherwise |
| Audit logs | Retain for a minimum of 2 years |
| Deactivated users | Soft-delete only (`is_active = false`). Do NOT hard-delete. |
| Attachments | Retain with the associated request |

Document the school's data retention policy in `PROJECT_CONTEXT.md`.

---

## 64. BROWSER COMPATIBILITY

The application must work on:

- **Google Chrome** (latest)
- **Microsoft Edge** (latest)

Do NOT spend effort on IE11 or legacy browser compatibility.

---

## END OF PROMPT
