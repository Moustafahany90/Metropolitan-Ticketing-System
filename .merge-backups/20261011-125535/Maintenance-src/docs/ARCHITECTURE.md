# Metropolitan School Maintenance Management System - Architecture

## Frontend Architecture
- **Framework**: React 18 with Vite dev server
- **Styling**: Tailwind CSS for responsive, utility-first design
- **Routing**: React Router v6 for role-based route protection
- **State Management**: React Context API or similar for global state (user, notifications)
- **HTTP Client**: Axios for API requests with interceptors for auth tokens
- **Form Handling**: React Hook Form with validation (Zod or Yup)
- **File Uploads**: Custom component with preview, validation (type, size, MIME)
- **Responsive Design**: Mobile-first breakpoints for phone, tablet, desktop
- **Build**: Vite for development, `npm run build` for production static assets
- **Production Serving**: Express.js serves static files from `client/dist/`

## Backend Architecture
- **Runtime**: Node.js 18+ with Express.js framework
- **Structure**: 
  - `src/config/` - Configuration management
  - `src/controllers/` - Request handlers
  - `src/routes/` - API route definitions
  - `src/services/` - Business logic (AuthService, LDAPService, RequestService, etc.)
  - `src/middleware/` - Custom middleware (auth, validation, error handling)
  - `src/repositories/` - Data access layer (Prisma wrapper)
  - `src/validators/` - Request validation schemas
  - `src/utils/` - Utility functions (date formatting, helpers)
- **API Design**: RESTful with consistent error responses
- **Authentication**: Session-based with express-session and connect-sqlite3 store
- **LDAP Integration**: activedirectory package or custom LDAP client
- **Microsoft Graph**: Microsoft Graph SDK for email sending
- **Validation**: Server-side validation using Joi or Zod
- **Error Handling**: Global error middleware, structured logging
- **Security**: Helmet.js for HTTP headers, rate limiting on login, CORS configuration
- **File Uploads**: Multer middleware with file type/size validation, storage in `uploads/`

## Database Architecture
- **ORM**: Prisma ORM with SQLite provider
- **Connection**: File-based SQLite database at `./data/maintenance.db`
- **Schema**:
  - `users`: AD-synced user records (username, display_name, email, department_id, role_id, is_active)
  - `roles`: Application roles (EMPLOYEE, SUPERVISOR, MAINTENANCE_WORKER, STORE_KEEPER, ADMIN)
  - `departments`: School departments (populated from AD or manually)
  - `maintenance_categories`: Request categories (Electrical, Plumbing, etc.)
  - `maintenance_requests`: Core request records with ticket number, status, timestamps
  - `request_assignments`: Assignment history (assigned_to, assigned_by, assigned_at)
  - `request_comments`: User comments on requests
  - `request_spare_parts`: Spare parts used per request
  - `request_attachments`: File attachment metadata
  - `notifications`: Email notification log (status, recipient, template)
  - `audit_logs`: Immutable audit trail of important actions
- **Indexes**: Proper indexing on foreign keys and frequently queried columns
- **Constraints**: Foreign key relationships, unique constraints (ticket_number)

## LDAP & Authentication Architecture
- **Connection**: Direct LDAP to domain controller on port 389 (no StartTLS for MVP)
- **Bind Strategy**: 
  1. Attempt bind with `sAMAccountName@metschool.local` format
  2. If fails, attempt direct bind with username/password against AD
  3. If bind succeeds, search for user to retrieve attributes
  4. If direct binding cannot retrieve attributes, document limitation
- **User Sync**: On first login, create user record; on subsequent logins, update syncable attributes
- **Session Management**: Server-side sessions stored in SQLite table
- **Password Handling**: Never store or transmit AD passwords; validate via LDAP bind only
- **Logout**: Destroy server session and clear client cookie

## Authorization Architecture
- **Middleware**: Role-based access control middleware checking:
  1. Authentication status
  2. User active status (`is_active`)
  3. Required role for endpoint/resource
  4. Resource ownership/access rights
- **Role Hierarchy**: Flat role structure with permissions assigned per role
- **Protected Routes**: All API routes under `/api/` require authentication
- **Resource-Based Rules**:
  - Employees: Can only access own requests unless explicitly shared
  - Supervisors: Can access all SUBMITTED requests for review/assignment
  - Maintenance Workers: Can only access assigned requests
  - Store Keepers: Can access requests with spare parts needs
  - Admins: Full access to all resources
- **Dynamic Checks**: Assignment-based access for in-progress requests

## Microsoft Graph & Email Architecture
- **Authentication**: Client Credentials Flow using Application Permissions
- **Required Permissions**: Mail.Send (Application permission)
- **Sender**: Fixed mailbox `maintenance@metropolitanschool.edu.eg`
- **Service**: Wrapper around Microsoft Graph SDK with error handling
- **Templates**: Separate email templates for:
  - New request notification (to supervisor)
  - Assignment notification (to maintenance worker)
  - Completion notification (to employee)
  - Rejection notification (to employee)
- **Failure Handling**: 
  - Email failures logged but do not roll back request transaction
  - Notification status stored in database
  - Retry mechanism for failed notifications (optional)
- **Configuration**: Environment variables for tenant ID, client ID, client secret, sender email

## Deployment Architecture
- **Development**: 
  - Vite dev server (port 5173) proxying to Express (port 3001)
  - Hot module replacement for frontend
  - Nodemon for backend restart on changes
- **Production**:
  - Single Node.js process serving both frontend static files and API
  - Express serves React build output from `client/dist/`
  - Port configurable via `PORT` environment variable (default 3001)
  - SQLite database file in `data/` directory
  - Uploads stored in `server/uploads/` directory
  - Process management via PM2 or Windows Service (future)
- **Environment**: Windows Server 2019/2022, Node.js LTS, SQLite
- **Network**: Internal school LAN only for MVP (HTTP acceptable)
- **Future Hardening**: Plan for HTTPS, LDAPS, reverse proxy

## Security Architecture
- **Authentication**: LDAP bind validation, session fixation prevention
- **Session**: HTTP-only cookies, secure flag false for HTTP (MVP), SameSite Lax
- **Input Validation**: 
  - Server-side validation on all API endpoints
  - File upload validation (MIME, extension, size < 5MB)
  - Sanitization to prevent XSS (though React escapes by default)
- **Output Encoding**: Proper encoding for any user-generated content displayed
- **API Security**: 
  - Rate limiting on authentication endpoint
  - CORS restricted to same origin in production
  - Security headers via Helmet.js
  - HTTPS enforcement planned for future
- **Data Protection**:
  - No sensitive data in logs (passwords, secrets, tokens)
  - Parameterized queries via Prisma (SQL injection prevention)
  - Environment variables for all secrets
  - `.env` file ignored by Git
- **Audit Logging**: Immutable audit trail for all significant actions
- **Error Handling**: 
  - Generic error messages to clients
  - Detailed logging server-side
  - Stack traces never exposed to clients

## Communication Architecture
- **Internal**: 
  - Browser ↔ Express: REST API over HTTP (MVP)
  - Express ↔ ActiveDirectory: LDAP over TCP port 389
  - Express ↔ Microsoft Graph: HTTPS REST API
  - Express ↔ SQLite: File-based database access
- **External Dependencies**:
  - Active Directory: Authentication and user attributes
  - Microsoft Graph: Email sending via maintenance@ mailbox
  - Internet: Required for Microsoft Graph calls (email)
- **Offline Capability**: 
  - Core ticket management works without internet
  - Email notifications queued and sent when connectivity restored
  - Local caching of user data for faster lookup

## Technology Choices Rationale
- **SQLite**: Simplicity, zero-configuration, easy Windows deployment, sufficient for internal school app
- **Prisma ORM**: Type-safe database access, automatic migrations, good developer experience
- **React/Vite**: Modern frontend toolkit, fast development, excellent performance
- **Tailwind CSS**: Utility-first CSS for rapid UI development with consistency
- **Express.js**: Minimal, flexible, well-suited for REST APIs
- **LDAP**: Direct integration with existing AD infrastructure
- **Microsoft Graph**: Secure, modern email sending via application permissions
- **Session-based Auth**: Simpler than JWT for traditional web app, server-side control
- **Modular Monolith**: Appropriate complexity for internal school application

## Known Limitations (MVP)
- HTTP instead of HTTPS for internal LAN (documented limitation)
- No LDAPS or StartTLS (if DC doesn't support it, documented)
- Global supervisor access to all requests (no department/category routing in MVP)
- Simple spare parts tracking (no full inventory module)
- File storage on local disk (not cloud/object storage)
- Basic backup strategy (manual/documented procedure)