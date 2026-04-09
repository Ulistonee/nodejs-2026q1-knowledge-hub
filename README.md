# Knowledge Hub API

NestJS REST API for users, categories, articles, and comments. Data is stored **in memory** (reset on server restart). OpenAPI (Swagger) UI is available at `/doc`.

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

The image is available at: **[hub.docker.com/r/<your-dockerhub-login>/knowledge-hub](https://hub.docker.com/r/<your-dockerhub-login>/knowledge-hub)**

Pull and run without cloning the repository:

```bash
docker pull <your-dockerhub-login>/knowledge-hub
docker run -p 4000:4000 -e PORT=4000 <your-dockerhub-login>/knowledge-hub
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

---

## Testing

1. Start the API in one terminal:

   ```bash
   npm run start:dev
   ```

2. In another terminal, run tests from the project root:

   ```bash
   npm run test
   ```
---

## Project structure (high level)

- `src/main.ts` — bootstrap, global `ValidationPipe`, Swagger at `/doc`, `PORT`.
- `src/app.module.ts` — root module, logging middleware, global `ApiKeyGuard` (optional).
- `src/user/`, `src/category/`, `src/article/`, `src/comment/` — feature modules (controller / service / DTOs).
- `src/common/` — shared middleware, guards, list-query DTOs, `applyListQuery` helper.
- `test/` — Jest e2e specs (`rootDir` in `jest.config.json`).

---
