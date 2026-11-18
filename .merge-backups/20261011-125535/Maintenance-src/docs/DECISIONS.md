| Decision | Reason |
|---|---|
| No mock/local authentication in any environment | The app must only authenticate against the real school AD; a dev fallback caused a critical bypass and is removed entirely (fail closed) |
| Bind to AD using the user's own credentials, then search with that session | No AD service account exists; least-privilege and avoids storing a privileged credential |
| LDAP filter values escaped per RFC 4515 | Prevents LDAP injection via username input |
| Session ID regenerated on successful login | Prevents session fixation |
| Keep `ldap://:389` with a startup security warning (TLS optional via env) | School DC's TLS support is unconfirmed; do not invent/downgrade TLS. `ldaps://` / `AD_STARTTLS=true` supported when IT confirms |
| Startup fails closed in production on misconfiguration | Missing AD config or non-AD auth mode must abort rather than allow access |
| Tailwind CSS v3 (not v4) | Explicit developer choice; stable v3 plugin/PostCSS workflow, JIT class scanning of JSX |
| Design tokens defined once in `tailwind.config.js` (`mms`, `status`, `priority`) | Prompt forbids hardcoded hex in components; single source of truth for brand + semantic colors |
| Light-only theme, no dark mode | MMS design prompt explicitly forbids dark-mode mixing; replaces previous dark navy theme |
| Shared Badge components for status/priority/role | Badge color+label pairing is a prompt requirement (never color alone); avoids duplicated class strings |
| Use SQLite for MVP | Internal school application, low complexity, easy Windows deployment, zero-configuration |
| Use Prisma ORM | Type-safe database access, automatic migrations, good developer experience, reduces boilerplate |
| Use application-level roles rather than AD groups | Current AD does not contain role groups for this application; avoids modifying AD structure |
| Modular monolith architecture | Appropriate complexity for internal school application; avoids over-engineering with microservices |
| Direct LDAP user binding (no service account) | Environment has no LDAP service account; implementation must work with user credentials for binding |
| Microsoft Graph for email notifications | Better security than storing Outlook credentials; uses application permissions with admin consent |
| Session-based authentication (not JWT) | Simpler for traditional web app, provides server-side session control, easy logout |
| React + Vite + Tailwind CSS | Modern frontend stack with excellent developer experience and performance for responsive UI |
| Node.js + Express.js | Well-suited for REST APIs, large ecosystem, familiar to developers, good for Windows deployment |
| Zero-padded sequential ticket numbers (MNT-XXXXXX) | Matches existing paper format, ensures uniqueness, avoids manual entry |
| Environment variables for all secrets | Prevents hard-coded credentials, enables different environments, security best practice |
| File upload validation (MIME, size, extension) | Security measure to prevent malicious file uploads while allowing necessary attachments |
| Separate email templates from business logic | Improves maintainability, allows template changes without code modifications |
| Optimistic concurrency control for status transitions | Prevents lost updates when multiple users modify same request simultaneously |
| Store files outside database (in uploads/ directory) | Better performance for file serving, avoids database bloat, easier backup/restore |