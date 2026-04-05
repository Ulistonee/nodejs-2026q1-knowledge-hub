# Home Library (Knowledge Hub API)

NestJS REST API for users, categories, articles, and comments. Data is stored **in memory** (reset on server restart). OpenAPI (Swagger) UI is available at `/doc`.

---

## Requirements

- **Node.js** `>= 22.14.0` (see `package.json` → `engines`)
- **npm** (comes with Node.js)
- **Git** (to clone the repository)

---

## Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
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

4. Edit `.env` if needed (see [Configuration](#configuration)).

---

## Configuration

Environment variables are read from `.env` (optional; you can also export variables in the shell).

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | HTTP port. Default: **4000** if unset. |
| `API_KEY` | No | If set, most routes require header `x-api-key: <same value>`. Omitted or unset → no API key check (good for local dev and tests). |
| `CRYPT_SALT`, `JWT_SECRET_KEY`, `JWT_SECRET_REFRESH_KEY`, `TOKEN_EXPIRE_TIME`, `TOKEN_REFRESH_EXPIRE_TIME` | No | Reserved for JWT/auth flows; see `.env.example`. |

**Swagger and health:** `GET /health` and paths under `/doc` are **not** protected by `API_KEY` when it is enabled.

---

## Running the application

Build the project (required for production start):

```bash
npm run build
```

| Command | When to use |
|---------|-------------|
| `npm run start:dev` | **Recommended for development** — watch mode, recompiles on save. |
| `npm start` | Single run (`nest start`), no file watching. |
| `npm run start:prod` | Production: runs compiled `dist/main.js` (run `npm run build` first). |
| `npm run start:debug` | Development with Node inspector. |

After startup, the console shows the listening URL, e.g. `http://localhost:4000`.

---

## Using the application

### Base URL

All API routes are relative to the server origin, e.g. `http://localhost:4000`.

Send JSON bodies with header:

```http
Content-Type: application/json
```

If `API_KEY` is set in `.env`, add:

```http
x-api-key: <your-api-key>
```

Avoid trailing spaces in URLs (e.g. use `/user`, not `/user%20`).

### OpenAPI (Swagger)

- Open **`http://localhost:4000/doc`** in a browser.
- Explore schemas and try requests from the UI.
- DTO shapes are enriched via the Nest Swagger compiler plugin (`nest-cli.json`).

### Health check

- **`GET /health`** — returns a small JSON payload (e.g. `{ "status": "ok" }`) for liveness checks.

### API overview (resources)

| Resource | Base path | Notes |
|----------|-----------|--------|
| Users | `/user` | List/create users; `GET/PUT/DELETE /user/:id` with UUID. Password never returned in JSON. |
| Categories | `/category` | Full CRUD; `:id` is UUID. |
| Articles | `/article` | Full CRUD; `:id` is UUID. Default `status` on create: `draft`; optional `authorId`, `categoryId`, `tags`. |
| Comments | `/comment` | **`GET /comment?articleId=<uuid>`** — `articleId` is **required** (query). `POST /comment`, `DELETE /comment/:id`. |

**Identifiers:** path parameters `:id` must be valid UUIDs where `ParseUUIDPipe` is used; otherwise the API responds with **400**.

**Cascading deletes (in-memory consistency):**

- Deleting a **user** sets `authorId` to `null` on their articles and removes comments authored by that user.
- Deleting a **category** sets `categoryId` to `null` on articles in that category.
- Deleting an **article** removes all comments for that article.

### Request logging

HTTP requests are logged (method, URL, status code, duration) via Nest **middleware** (`LoggingMiddleware`).

---

## Testing

End-to-end tests use **supertest** against a running server on `PORT` (default **4000**).

1. Start the API in one terminal:

   ```bash
   npm run start:dev
   ```

2. In another terminal, run tests from the project root:

   ```bash
   npm run test
   ```

Run a single suite (example):

```bash
npm run test -- users.e2e.spec.ts
```

With auth (`TEST_MODE=auth`; see template):

```bash
npm run test:auth
npm run test:refresh   # only refresh-token flow
npm run test:rbac      # only test/rbac/*.e2e.spec.ts
```

---

## Project structure (high level)

- `src/main.ts` — bootstrap, global `ValidationPipe`, Swagger at `/doc`, `PORT`.
- `src/app.module.ts` — root module, logging middleware, global `ApiKeyGuard` (optional).
- `src/user/`, `src/category/`, `src/article/`, `src/comment/` — feature modules (controller / service / DTOs).
- `src/common/` — shared middleware and guards.
- `test/` — Jest e2e specs (`rootDir` in `jest.config.json`).

---
