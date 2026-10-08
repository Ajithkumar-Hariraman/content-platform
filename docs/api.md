# API reference

The machine-readable OpenAPI 3.1 specification is maintained in server/src/openapi/specification.ts. Development reference HTML is served at /api/docs and JSON at /api/docs/openapi.json. It documents auth, users, public/admin Products, Content, Categories, Activity and Health, including schemas, errors, permissions, CSRF and pagination. ENABLE_API_DOCS defaults to disabled in production unless explicitly enabled.

## Authentication workflow

POST /api/v1/auth/login with JSON email/password establishes a new HttpOnly cookie session and returns user, permissions and csrfToken. The session token is excluded from JSON. GET /api/v1/auth/me returns the current public user/permissions and validated session CSRF token. Retain that CSRF token only in application memory and send X-CSRF-Token on every authenticated mutation. Send cookies with credentials: include when using the configured frontend origin.

POST /api/v1/auth/logout revokes the current session and clears cookies (204). POST /api/v1/auth/change-password accepts currentPassword/newPassword, revokes all sessions, clears cookies (204), and requires another login. Both require CSRF. Missing/expired/revoked/disabled sessions return 401; invalid credentials have the same generic 401 response.

## Administrative APIs

/api/v1/admin/products provides permission-protected Product reads and CRUD. Existing /api/v1/products GETs remain public; its legacy mutation URLs enforce the same authentication, CSRF and permissions. /api/v1/admin/content and /api/v1/admin/activity are protected. Public Content APIs still select PUBLISHED in PostgreSQL. Publication/archive require CONTENT_PUBLISH; deletion requires domain-specific DELETE permissions.

GET /api/v1/admin/users supports page/limit (defaults 1/20, maximum 1,000,000/100). POST creates an ACTIVE user from email, initial password and role (201). PATCH /:id/role and PATCH /:id/status accept only their named field (200). All user operations require ADMIN permissions. Password hashes are never returned. Duplicated normalized emails and attempts to remove the last active administrator return 409.

Product/Content collections return data and pagination. Activity returns data and nullable nextCursor; entity filters must be paired. Item responses use data, except auth responses which directly expose user/permissions/csrfToken. DELETE, logout and password-change success responses are empty 204. Content/Product creation returns 201 and Location. Editing and lifecycle operations return 200.

Errors consistently use { error: { code, message, requestId } }. Invalid input is 400, unauthenticated 401, permission/CSRF/origin rejection 403, missing resources 404, conflicts 409, oversized JSON 413, unsupported login content type 415, rate limits 429, and dependency failures 503. Unexpected server errors expose no internal details. Session cookies are Secure in production and usable over localhost HTTP in development.

See [security](security.md) for role mapping, session/CSRF details, cookie policy, rate limits and deployment boundaries; [events](events.md) for asynchronous audit delivery; [headless CMS](headless-cms.md) for editorial lifecycle.

GET /api/v1/admin/diagnostics/performance requires USER_WRITE and cookie authentication. It returns process-local bounded metrics, pool statistics, memory and CPU diagnostics with no-store caching; it is not a public monitoring endpoint.
