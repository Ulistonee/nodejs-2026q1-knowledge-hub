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

### Logging (optional tuning)

`LOG_LEVEL` (default `log`) caps how chatty the Nest logger is. In production, set
`NODE_ENV=production` for JSON logs to stdout and to `LOG_DIR`/`app.log`. `LOG_MAX_FILE_SIZE` is
the log file size limit in **kilobytes** before rotation (default `1024`).

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

1. Start the API in one terminal


   ```bash
   docker compose up --build
   ```

2. In another terminal, run tests from the project root:

   | Command | Scope |
   |---|---|
   | `npm run test:e2e` | base end-to-end suite (CRUD, pagination, sorting) |
   | `npm run test:auth` | base suite + auth-required checks (all protected routes reject without token) |
   | `npm run test:refresh` | refresh-token flow (issue, expire, invalidate) |
   | `npm run test:rbac` | RBAC policy per role (viewer / editor / admin) |

---
