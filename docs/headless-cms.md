# Headless CMS

The API stores editorial content and publishing state independently of presentation. The React administration portal edits content; public React pages consume published content over REST. Other clients can consume the same public API without inheriting React rendering or page templates. Body content is plain text, rendered with React escaping and preserved line breaks.

## API contracts

| Method | Endpoint                          | Success                            |
| ------ | --------------------------------- | ---------------------------------- |
| GET    | /api/v1/admin/content             | 200, data and pagination           |
| GET    | /api/v1/admin/content/:id         | 200, data                          |
| POST   | /api/v1/admin/content             | 201, data and Location             |
| PATCH  | /api/v1/admin/content/:id         | 200, data                          |
| POST   | /api/v1/admin/content/:id/publish | 200, data                          |
| POST   | /api/v1/admin/content/:id/archive | 200, data                          |
| DELETE | /api/v1/admin/content/:id         | 204                                |
| GET    | /api/v1/content                   | 200, published data and pagination |
| GET    | /api/v1/content/:slug             | 200 published data, otherwise 404  |

Admin create requires title, slug, body; summary is optional/nullable. PATCH accepts those editorial fields only and requires at least one. Status and publication timestamps cannot be supplied. Slugs contain lowercase letters/digits separated by single hyphens. Titles are limited to 200 characters, summaries 5,000, bodies 50,000. IDs must be UUIDs. Unknown fields are rejected. Errors use `{ error: { code, message, requestId } }`: invalid input 400, missing content 404, duplicate slug 409, invalid transition 409.

Both collections accept page (default 1, maximum 1,000,000), limit (default 10, maximum 100), search (literal title/summary substring, maximum 200), and order (asc/desc, default desc). Admin additionally accepts status (DRAFT/PUBLISHED/ARCHIVED) and sort (createdAt/publishedAt/title, default createdAt). Public sort is publishedAt/title, default publishedAt; a public status parameter is rejected. Pagination includes page, limit, total, totalPages; zero results has totalPages 0.

## Lifecycle

```text
Create -> DRAFT -> Publish -> PUBLISHED -> Archive -> ARCHIVED
             \---------------- Archive ----------------/
```

Publishing a published item is idempotent, retaining the first published_at and unchanged updated_at. Archive is idempotent and preserves historical publication metadata. Archived content cannot be published or restored in Phase 3. Editing is permitted in every state and never changes state. Editing published content updates public delivery immediately; revision/review workflows are outside this phase.

Public repositories enforce PUBLISHED in both list and slug SQL. Draft and archived slugs return the same 404 as missing slugs. UI visibility does not provide the publishing boundary. Admin/public separation is an API responsibility boundary. Administrative endpoints now require a verified session, explicit permissions and CSRF for mutations.

## Request flows

Creation: controlled ContentForm -> typed saveContent request -> POST admin route -> Zod body validation in controller -> ContentService.create -> ContentRepository.create -> parameterized INSERT (database DRAFT default) -> row mapping -> 201 and Location -> notification and list refresh.

Publishing: explicit Publish button -> POST /admin/content/:id/publish -> UUID validation -> ContentService loads content, rejects ARCHIVED -> repository atomic UPDATE restricted to DRAFT/PUBLISHED -> server timestamp -> mapped content -> 200 -> notification and list refresh. A concurrent archive cannot bypass the SQL predicate; disappearance returns 404, competing transition 409.

Public delivery: /content search/pagination -> debounced typed API request -> public controller query validation -> ContentService.list -> repository SELECT with status=PUBLISHED -> mapped page/count -> 200 -> React list. Selecting a slug -> /content/:slug -> published-only repository lookup -> 200 or 404 -> safe plain-text detail rendering.

Persistence uses pg with explicit columns, bound values, allow-listed sorting, and database constraints. Services contain lifecycle rules and translate known conflicts. Controllers contain HTTP semantics; repositories contain no HTTP or React concerns.
