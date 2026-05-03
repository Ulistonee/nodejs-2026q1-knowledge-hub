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

### Build and run locally with Docker Compose

```bash
# Start all services (app + PostgreSQL)
docker compose up --build
```

### Docker Scout CVE report (brief)

Build an image, then scan (image name may differ; with Compose use `docker images` and pick the `*-app` tag):

```bash
docker build -t knowledge-hub-app .
docker scout cves knowledge-hub-app
```

Example snapshot from `docker scout cves` (numbers change when you rebuild, update the base image, or when Scout refreshes its advisories):


|                  |                                                                                |
| ---------------- | ------------------------------------------------------------------------------ |
| Image            | `nodejs-2026q1-knowledge-hub-app:latest`                                       |
| Platform         | `linux/arm64`                                                                  |
| Packages indexed | ~358                                                                           |
| Severities       | 0 Critical, 7 High, 4 Medium, 1 Low, 5 Unspecified (17 findings in 7 packages) |


---

## Testing

### Unit tests (Vitest)

Unit tests live next to the code under `src/**/__tests__/*.unit.spec.ts` and run
in isolation — Prisma and other I/O is mocked, no network or DB is required.


| Command                 | Scope                                                                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test`          | runs the full unit-test suite via Vitest                                                                                                                                                |
| `npm run test:unit`     | alias of `npm run test` (unit tests only)                                                                                                                                               |
| `npm run test:coverage` | runs all unit tests with v8 coverage and enforces the configured thresholds (lines ≥ 90%, branches ≥ 85%, statements ≥ 90%, functions ≥ 85%); exits non-zero if any threshold is missed |
| `npm run test:watch`    | watch mode for local development                                                                                                                                                        |


Coverage thresholds are configured in `vitest.config.ts`.

### Integration / e2e tests (Jest)

End-to-end tests live in `test/` and require a running API + PostgreSQL.

1. Start the API in one terminal
  ```bash
   docker compose up --build
  ```
2. In another terminal, run tests from the project root:

  | Command                | Scope                                                                         |
  | ---------------------- | ----------------------------------------------------------------------------- |
  | `npm run test:e2e`     | base end-to-end suite (CRUD, pagination, sorting)                             |
  | `npm run test:auth`    | base suite + auth-required checks (all protected routes reject without token) |
  | `npm run test:refresh` | refresh-token flow (issue, expire, invalidate)                                |
  | `npm run test:rbac`    | RBAC policy per role (viewer / editor / admin)                                |


---

## AI features (Google Gemini)

This API exposes AI helpers under the `/ai` prefix.

### Gemini API key (step by step)

1. Sign in with a Google account at [Google AI Studio](https://aistudio.google.com/).
2. Open **Get API key** / **API keys** in the dashboard.
3. Click **Create API key**.
4. Copy the key.

### Model

Default model is set by `**GEMINI_MODEL`** (see `.env.example`), typically `**gemini-2.0-flash**`.

### Setup after clone

1. Copy `.env.example` to `.env`.
2. Set `**GEMINI_API_KEY**` to your key from AI Studio (replace `your-gemini-api-key`).
3. Optional tuning:
  - `**GEMINI_API_BASE_URL**` — default `https://generativelanguage.googleapis.com`
  - `**GEMINI_MODEL**` — model id for `:generateContent`
  - `**AI_RATE_LIMIT_RPM**` — max AI HTTP requests per minute **per client IP** on `/ai/*` (default `20`); when exceeded the API returns **429** with `**Retry-After`** (seconds).
  - `**AI_CACHE_TTL_SEC**` — in-memory TTL for **summarize** and **translate** responses (default `300`); cache keys include `articleId`, request parameters, and article `**updatedAt`** so edits invalidate cached output.

### Run and try AI endpoints

Start the stack:

```bash
docker compose up --build
```

Obtain a JWT (e.g. signup/login via `/auth`). Then call:


| Method | Path                                | Body (JSON)                                                                                              |
| ------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `GET`  | `/ai/usage`                         | — *(admin JWT only; returns request/token totals, per-endpoint counts, Gemini latency, cache hit ratio)* |
| `POST` | `/ai/articles/:articleId/summarize` | `{ "maxLength": "short" | "medium" | "detailed" }` (all optional; default `medium`)                      |
| `POST` | `/ai/articles/:articleId/translate` | `{ "targetLanguage": "French", "sourceLanguage": "en" }` (`targetLanguage` required)                     |
| `POST` | `/ai/articles/:articleId/analyze`   | `{ "task": "review" | "bugs" | "optimize" | "explain" }` (optional; default `review`)                    |
| `POST` | `/ai/generate`                      | `{ "prompt": "Your question…" }`                                                                         |


Example (replace `TOKEN` and article UUID):

```bash
curl -sS -X POST "http://localhost:4000/ai/articles/00000000-0000-4000-8000-000000000001/summarize" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"maxLength":"short"}'
```

---

