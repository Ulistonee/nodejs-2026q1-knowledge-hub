# Knowledge Hub API

NestJS REST API for users, categories, articles, and comments. Data is persisted
in PostgreSQL via Prisma ORM. All business routes are protected by JWT
authentication with role-based access control (`viewer` / `editor` / `admin`).
OpenAPI (Swagger) UI is available at `/doc`.

---

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Ulistonee/nodejs-2026q1-knowledge-hub
   cd nodejs-2026q1-knowledge-hub
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a local environment file from the example:

   ```bash
   cp .env.example .env
   ```

4. Edit `.env` if needed

---

## Running the application

Build the project (required for production start):

```bash
npm run start
```

| Command | When to use |
|---------|-------------|
| `npm run start:dev` | **Recommended for development** — watch mode, recompiles on save. |
| `npm start` | Single run (`nest start`), no file watching. |

After startup, the console shows the listening URL, e.g. `http://localhost:4000`.

---

## Using the application

### Base URL

All API routes are relative to the server origin, e.g. `http://localhost:4000`.

Send JSON bodies with header:

```http
Content-Type: application/json
```

Avoid trailing spaces in URLs (e.g. use `/user`, not `/user%20`).

### OpenAPI (Swagger)

- Open **`http://localhost:4000/doc`** in a browser.
- Explore schemas and try requests from the UI.
- DTO shapes are enriched via the Nest Swagger compiler plugin (`nest-cli.json`).

### Health check

- **`GET /health`** — returns a small JSON payload (e.g. `{ "status": "ok" }`) for liveness checks.

### Authentication

The API uses JWT access + refresh tokens. The access token must be sent with
every request to protected routes using the `Bearer` scheme:

```http
Authorization: Bearer <accessToken>
```

Public routes (no token required): `GET /`, `GET /health`, `GET /doc`,
`POST /auth/signup`, `POST /auth/login`, `POST /auth/refresh`. All other
routes respond with **401** if the `Authorization` header is missing, not in
the `Bearer` form, or if the access token is invalid/expired.

Auth endpoints:

| Method & route | Body | Response |
|---|---|---|
| `POST /auth/signup` | `{ login, password }` | `201 { id }` / `400` on validation or duplicate login |
| `POST /auth/login` | `{ login, password }` | `200 { accessToken, refreshToken }` / `400` on invalid DTO / `403` on bad credentials |
| `POST /auth/refresh` | `{ refreshToken }` | `200 { accessToken, refreshToken }` / `401` without body / `403` on invalid/expired/revoked refresh token |
| `POST /auth/logout` *(auth required)* | `{ refreshToken }` | `204` — blacklists the refresh token so it cannot be used again |

JWT access token payload:

```json
{ "userId": "<uuid>", "login": "...", "role": "admin" | "editor" | "viewer" }
```

Access-token TTL and refresh-token TTL are configured via `.env`
(`TOKEN_EXPIRE_TIME`, `TOKEN_REFRESH_EXPIRE_TIME`). Secrets for signing are
`JWT_SECRET_KEY` and `JWT_SECRET_REFRESH_KEY` in `.env`.

`POST /auth/signup` and `POST /auth/login` are additionally rate-limited
(via `@nestjs/throttler`) to mitigate brute-force.

### Role-based access control (RBAC)

Every authenticated request carries the user role in the JWT payload. The
`RolesGuard` enforces the following policy:

| Role | Permissions |
|---|---|
| `viewer` | Read-only: all `GET` endpoints. |
| `editor` | Same as `viewer` + can `POST` and `PUT` their own articles and comments. Cannot delete other users' content or manage categories/users. |
| `admin` | Full access to every resource and operation. |

Unauthorized operations return **403** with a descriptive message.

New users created via `POST /auth/signup` are always assigned the `viewer`
role. Role changes are performed only by an `admin` through `PUT /user/:id`.

### List endpoints: pagination and sorting

For **`GET /user`**, **`GET /category`**, **`GET /article`**, and **`GET /comment`** (with required `articleId` query):

| Query | Description |
|-------|-------------|
| `page` | Page number (integer ≥ 1). |
| `limit` | Page size (integer 1–100). |
| `sortBy` | Field name allowed for that resource (e.g. `createdAt`, `login`, `title`). |
| `order` | `asc` or `desc` (default `asc` when sorting). |

If **`page` or `limit` is present**, the response is:

```json
{ "total": 42, "page": 1, "limit": 10, "data": [ ... ] }
```

## Docker

### Docker Hub

Pre-built container image for this API on Docker Hub: **[aizhanbexatova/knowledge-hub](https://hub.docker.com/r/aizhanbexatova/knowledge-hub)** — pull `latest` or another tag from the **Tags** tab on that page.

Pull and run without cloning the repository:

```bash
docker pull aizhanbexatova/knowledge-hub:latest
docker run -p 4000:4000 -e PORT=4000 aizhanbexatova/knowledge-hub:latest
```

### Build and run locally with Docker Compose

```bash
# Copy environment file
cp .env.example .env

# Start all services (app + PostgreSQL)
docker compose up --build

# Start with Adminer UI for DB inspection (http://localhost:8080)
docker compose --profile debug up --build
```

### Build image manually

```bash
docker build -t knowledge-hub .
docker run -p 4000:4000 --env-file .env knowledge-hub
```

### Docker Scout CVE report (brief)

Build an image, then scan (image name may differ; with Compose use `docker images` and pick the `*-app` tag):

```bash
docker build -t knowledge-hub-app .
docker scout cves knowledge-hub-app
```

Example snapshot from `docker scout cves` (numbers change when you rebuild, update the base image, or when Scout refreshes its advisories):

| | |
|---|---|
| Image | `nodejs-2026q1-knowledge-hub-app:latest` |
| Platform | `linux/arm64` |
| Packages indexed | ~358 |
| Severities | 0 Critical, 7 High, 4 Medium, 1 Low, 5 Unspecified (17 findings in 7 packages) |

---

## Testing

### Unit tests (Vitest)

Unit tests live next to the code under `src/**/__tests__/*.unit.spec.ts` and run
in isolation — Prisma and other I/O is mocked, no network or DB is required.

| Command | Scope |
|---|---|
| `npm run test` | runs the full unit-test suite via Vitest |
| `npm run test:unit` | alias of `npm run test` (unit tests only) |
| `npm run test:coverage` | runs all unit tests with v8 coverage and enforces the configured thresholds (lines ≥ 90%, branches ≥ 85%, statements ≥ 90%, functions ≥ 85%); exits non-zero if any threshold is missed |
| `npm run test:watch` | watch mode for local development |

Coverage thresholds are configured in `vitest.config.ts`.

### Integration / e2e tests (Jest)

End-to-end tests live in `test/` and require a running API + PostgreSQL.

1. Start the API in one terminal (the Docker setup runs `prisma migrate deploy`
   on boot, so the DB is ready automatically):

   ```bash
   docker compose up --build
   ```

   or, for local development without Docker:

   ```bash
   npm run prisma:migrate
   npm run start:dev
   ```

2. In another terminal, run tests from the project root:

   | Command | Scope |
   |---|---|
   | `npm run test:e2e` | base end-to-end suite (CRUD, pagination, sorting) |
   | `npm run test:auth` | base suite + auth-required checks (all protected routes reject without token) |
   | `npm run test:refresh` | refresh-token flow (issue, expire, invalidate) |
   | `npm run test:rbac` | RBAC policy per role (viewer / editor / admin) |

---

## Project structure (high level)

- `src/main.ts` — bootstrap, global `ValidationPipe`, Swagger at `/doc`, `PORT`.
- `src/app.module.ts` — root module, logging middleware, global `JwtAuthGuard` and `RolesGuard`, `ThrottlerGuard`.
- `src/auth/` — signup / login / refresh / logout, JWT issuing and refresh-token blacklist.
- `src/user/`, `src/category/`, `src/article/`, `src/comment/` — feature modules (controller / service / DTOs).
- `src/common/decorators/` — `@Public()` to opt out of auth, `@Roles(...)` to require roles.
- `src/common/guards/` — `JwtAuthGuard`, `RolesGuard`, `ApiKeyGuard`.
- `src/common/pipes/` — custom validation pipes (e.g. `ParseUuidPipe`).
- `src/common/interceptors/` — response interceptors (e.g. `StripPasswordInterceptor`).
- `src/common/filters/` — exception filters (`AllExceptionsFilter`).
- `src/common/` — shared middleware, list-query DTOs, `applyListQuery` helper.
- `src/**/__tests__/*.unit.spec.ts` — Vitest unit tests (services, guards, pipes, DTOs, interceptor, filter).
- `prisma/` — Prisma schema, migrations, optional seed script.
- `test/` — Jest e2e specs (`rootDir` in `jest.config.json`); `test/auth`, `test/refresh`, `test/rbac` cover the auth stage.
- `vitest.config.ts` — unit-test runner configuration with coverage thresholds.

---
