# Security

## Authentication and sessions

PostgreSQL stores normalized unique emails, scrypt password hashes, centrally mapped roles, and account status. Password hashing uses Node crypto.scrypt with N=131072, r=8, p=1, a random 16-byte salt and a 64-byte key. Verification uses timingSafeEqual. Password input is bounded to 128 characters/256 UTF-8 bytes; new passwords require at least 12 characters. Two concurrent derivations per API process bound memory usage; additional work receives AUTH_BUSY rather than an unbounded queue. Invalid/missing/disabled accounts share a generic login response and perform password derivation.

This parameter choice follows [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) and uses [Node crypto](https://nodejs.org/api/crypto.html). Password hashes and credentials are excluded from transport, logs, and events.

Login generates independent 256-bit opaque session and CSRF tokens. Only SHA-256 token hashes are stored in user_sessions. Login creates a new session and revokes the presented previous session under a user-row lock; it cannot fixate an existing token. Credential/status are rechecked when creating the session, protecting against a concurrent password/access change. Sessions have an absolute expiry (default eight hours, configurable from one to 24); last_seen_at records activity without extending expiry. There is no refresh-token/JWT layer.

Middleware extracts the exact session cookie, hashes it, and joins active users with unexpired, unrevoked sessions. Duplicate/malformed cookies are rejected. Roles are read from PostgreSQL on each authenticated request. Logout revokes the server record and clears both cookies. Password change verifies the current password, updates the hash atomically, revokes every session, and requires a new login. Role/status changes also revoke all sessions. An already-authorized in-flight request may complete while access is being changed; subsequent requests must authenticate again.

Production uses __Host-cloudops_session and __Host-cloudops_csrf, with Secure, HttpOnly, SameSite=Lax, Path=/, no Domain, and bounded Max-Age. Development uses cloudops_session/cloudops_csrf without Secure for localhost HTTP. The raw session token never appears in JSON or browser storage. Auth/admin responses set Cache-Control: no-store. Deploy production with HTTPS and a same-site frontend/API; cross-site cookie deployment is not configured.

## CSRF and origins

The companion CSRF cookie is also HttpOnly. Login returns its token in JSON. GET auth/me reads the companion cookie, verifies it against the current session hash, and returns it to the permitted frontend. React keeps it in memory and sends X-CSRF-Token on mutations. It is never placed in localStorage or URLs. This permits reloads and concurrent tabs without rotating the token on every read.

Authenticated POST/PATCH/DELETE requests must provide a matching session-bound token. Public reads do not require it. Login requires application/json, rejects unexpected browser origins, and is rate limited. State-changing authenticated requests also reject unexpected Origin values. CORS permits only CLIENT_ORIGIN with credentials and explicit request headers. Command-line clients may omit Origin but must send the session cookie and CSRF header; they do not create a browser cross-origin bypass. SameSite is defense in depth, not the CSRF control. See [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

## Authorization

| Role   | Permissions                                                                      |
| ------ | -------------------------------------------------------------------------------- |
| VIEWER | PRODUCT_READ, CONTENT_READ, ACTIVITY_READ                                        |
| EDITOR | Viewer permissions plus PRODUCT_WRITE, CONTENT_WRITE, CONTENT_PUBLISH            |
| ADMIN  | All permissions, including PRODUCT_DELETE, CONTENT_DELETE, USER_READ, USER_WRITE |

The central rolePermissions map is the authorization policy. Admin routes authenticate before dispatch and authorize explicit permissions; protected operations deny by default. Product/Content public GET routes remain public. Legacy Product mutation URLs are authenticated, CSRF protected and permission checked, matching /admin/products. Publish/archive require CONTENT_PUBLISH. User management requires ADMIN permissions.

A PostgreSQL advisory transaction lock serializes access changes. The last ACTIVE ADMIN cannot be disabled or demoted. User creation does not offer an unprotected registration route; there is no delete-user API. React route guards and permission-aware controls improve the experience; server checks provide enforcement.

Authenticated Product/Content events capture actor.kind USER and the verified user UUID through request-scoped AsyncLocalStorage. It does not leak between requests. System operations use SYSTEM; historical ADMIN_PORTAL events remain readable. No passwords, hashes, session tokens or CSRF tokens enter event payloads.

## HTTP hardening and operation

Helmet supplies security headers, CSP, frame restrictions, MIME sniffing protection, and production HSTS. HTTPS-upgrade/HSTS directives are disabled for local HTTP. Express identification is disabled. JSON input remains bounded to 100 KB. Request IDs and safe API errors are retained; request bodies and cookie/authorization headers are not logged.

General API limiting is 120 requests/minute/IP. Login and password-change endpoints additionally share a ten-attempt/15-minute/IP limiter. Limits count all attempts, including successful ones. IPv6 handling uses express-rate-limit defaults. Stores are in-process and reset on restart; they are not a cross-instance quota. A deployment with multiple instances must enforce a corresponding limit at its trusted ingress or configure an appropriate shared store in a later phase. Proxy headers are not blindly trusted; direct deployments use the connection peer address. Configure trusted proxies explicitly before proxy deployment.

/api/docs and its OpenAPI JSON are enabled by default outside production; ENABLE_API_DOCS can explicitly override this. Production defaults to disabled. Do not carry a development ENABLE_API_DOCS=true into production unintentionally. Health/readiness remains PostgreSQL based; DynamoDB delivery may lag independently.

Development administrator credentials must be supplied through DEV_ADMIN_EMAIL and DEV_ADMIN_PASSWORD. No real password is committed. The account uses a fixed initial UUID. Seeding is prohibited outside development. Repeated seeding preserves the account when the password matches; an explicitly changed seed password revokes sessions. It refuses to silently promote/reactivate an existing non-active administrator email.

Security integration tests require a dedicated TEST_DATABASE_URL and local HTTP socket access. Password hashing, services, permissions, CSRF, cookie attributes, lifecycle SQL and actor scoping also have socket-free tests. Email verification, MFA, account recovery, external identity providers and automated session retention are not implemented in Phase 5.

Redis caches public Product/Content data only. Users, credentials, sessions and administrative responses bypass it. Query administrative keys are scoped to the authenticated user and are removed after identity changes. Internal performance diagnostics require USER_WRITE. The general limiter can be bypassed only through development-only PERFORMANCE_MODE; authentication limits and authorization stay active.
