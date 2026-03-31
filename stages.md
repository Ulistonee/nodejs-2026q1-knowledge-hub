# Implementation Stages: Nest.js Knowledge Hub API

## Current State

- [x] NestJS project bootstrapped
- [x] `src/users/` module skeleton created (needs corrections)
- [ ] `.env` file created
- [ ] `@nestjs/swagger` installed
- [ ] `main.ts` configured (ValidationPipe, Swagger, PORT from env)

---

## Stage 0 — Project Setup

**Goal:** working foundation before any feature implementation.

- [ ] Create `.env` from `.env.example` (only `PORT=4000` is needed for now)
- [ ] Install `@nestjs/swagger` and `@nestjs/config`:
  ```bash
  npm install @nestjs/swagger @nestjs/config
  ```
- [ ] Update `main.ts`:
  - Read `PORT` from environment via `process.env.PORT`
  - Register global `ValidationPipe` with `{ whitelist: true, forbidNonWhitelisted: true }`
  - Set up Swagger (`DocumentBuilder`, `SwaggerModule.setup('doc', ...)`)
- [ ] Clean up `app.controller.ts` and `app.service.ts` (remove boilerplate or delete if not needed)
- [ ] Register `UsersModule` in `AppModule`

**Checklist after stage:**
- `npm start` runs without errors on port 4000
- `GET /` returns something sensible or 404
- `GET /doc` opens Swagger UI

---

## Stage 1 — User Module

**Goal:** full CRUD for `/user` with correct validation and password exclusion.

### Files to create / fix

```
src/user/
  user.module.ts
  user.controller.ts
  user.service.ts
  enums/user-role.enum.ts
  dto/create-user.dto.ts
  dto/update-password.dto.ts
```

> Note: route prefix must be `/user` (singular), not `/users` — the tests use `/user`.

### Enums

```typescript
// enums/user-role.enum.ts
export enum UserRole {
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}
```

### DTOs

```typescript
// dto/create-user.dto.ts
export class CreateUserDto {
  @IsString() @IsNotEmpty() login: string;
  @IsString() @IsNotEmpty() password: string;
  @IsEnum(UserRole) @IsOptional() role?: UserRole; // defaults to 'viewer'
}

// dto/update-password.dto.ts
export class UpdatePasswordDto {
  @IsString() @IsNotEmpty() oldPassword: string;
  @IsString() @IsNotEmpty() newPassword: string;
}
```

### Service (in-memory)

```typescript
private users: User[] = [];
```

- `findAll()` → return users without `password` field
- `findOne(id)` → 404 if not found
- `create(dto)` → uuid v4 via `crypto.randomUUID()`, `role` defaults to `'viewer'`
- `updatePassword(id, dto)` → 404 if not found, 403 if `oldPassword` wrong
- `remove(id)` → 204, handle cascades (Stage 5)

### Controller endpoints

| Method | Path | Status codes |
|--------|------|--------------|
| GET | `/user` | 200 |
| GET | `/user/:id` | 200, 400 (invalid uuid), 404 |
| POST | `/user` | 201, 400 |
| PUT | `/user/:id` | 200, 400, 403, 404 |
| DELETE | `/user/:id` | 204, 400, 404 |

### Key notes

- Use `ParseUUIDPipe` for `:id` params → automatically returns 400 for non-uuid
- Exclude `password` from all responses (use `delete user.password` or `@Exclude()` + `ClassSerializerInterceptor`)

**Checklist after stage:**
- `test/users.e2e.spec.ts` passes (run `npm test` after starting the server)

---

## Stage 2 — Category Module

**Goal:** simple CRUD for `/category`, no relations yet.

```
src/category/
  category.module.ts
  category.controller.ts
  category.service.ts
  dto/create-category.dto.ts
  dto/update-category.dto.ts
```

### DTO

```typescript
export class CreateCategoryDto {
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() description: string;
}
```

### Endpoints

| Method | Path | Status codes |
|--------|------|--------------|
| GET | `/category` | 200 |
| GET | `/category/:id` | 200, 400, 404 |
| POST | `/category` | 201, 400 |
| PUT | `/category/:id` | 200, 400, 404 |
| DELETE | `/category/:id` | 204, 400, 404 |

This stage is the simplest — good for solidifying the pattern before more complex modules.

---

## Stage 3 — Article Module

**Goal:** CRUD for `/article` with filtering support.

```
src/article/
  article.module.ts
  article.controller.ts
  article.service.ts
  enums/article-status.enum.ts
  dto/create-article.dto.ts
  dto/update-article.dto.ts
```

### Enum

```typescript
export enum ArticleStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}
```

### DTO

```typescript
export class CreateArticleDto {
  @IsString() @IsNotEmpty() title: string;
  @IsString() @IsNotEmpty() content: string;
  @IsEnum(ArticleStatus) @IsOptional() status?: ArticleStatus; // defaults to 'draft'
  @IsUUID() @IsOptional() authorId?: string;
  @IsUUID() @IsOptional() categoryId?: string;
  @IsArray() @IsString({ each: true }) @IsOptional() tags?: string[];
}
```

### Filtering (GET /article)

Support query params: `status`, `categoryId`, `tag`

```
GET /article?status=published&tag=nodejs
GET /article?categoryId=<uuid>
```

### Endpoints

| Method | Path | Status codes |
|--------|------|--------------|
| GET | `/article` | 200 (+ optional filters) |
| GET | `/article/:id` | 200, 400, 404 |
| POST | `/article` | 201, 400 |
| PUT | `/article/:id` | 200, 400, 404 |
| DELETE | `/article/:id` | 204, 400, 404 |

---

## Stage 4 — Comment Module

**Goal:** comments tied to articles.

```
src/comment/
  comment.module.ts
  comment.controller.ts
  comment.service.ts
  dto/create-comment.dto.ts
```

### DTO

```typescript
export class CreateCommentDto {
  @IsString() @IsNotEmpty() content: string;
  @IsUUID() articleId: string;
  @IsUUID() @IsOptional() authorId?: string;
}
```

### Endpoints

| Method | Path | Status codes |
|--------|------|--------------|
| GET | `/comment?articleId=<uuid>` | 200 (`articleId` is **required**) |
| POST | `/comment` | 201, 400 (missing fields), 422 (articleId not found) |
| DELETE | `/comment/:id` | 204, 400, 404 |

### Key notes

- `GET /comment` without `articleId` → 400
- `POST /comment` with non-existent `articleId` → 422 `UnprocessableEntityException`
- To check if article exists, inject `ArticlesService` into `CommentsService` (export it from `ArticleModule`)

---

## Stage 5 — Cascading Deletes

**Goal:** referential integrity on delete (in-memory).

Wire services together via module exports/imports:

| Deleted entity | Effect |
|----------------|--------|
| `User` | Set `authorId = null` in all their Articles; delete all their Comments |
| `Category` | Set `categoryId = null` in all Articles of that category |
| `Article` | Delete all Comments for that article |

Implementation approach — inject dependent services:

```typescript
// users.service.ts
constructor(
  private readonly articlesService: ArticlesService,
  private readonly commentsService: CommentsService,
) {}

remove(id: string) {
  // ...
  this.articlesService.nullifyAuthor(id);
  this.commentsService.removeByAuthor(id);
}
```

Add helper methods to each service: `nullifyAuthor`, `nullifyCategory`, `removeByArticle`, `removeByAuthor`.

---

## Stage 6 — Cross-cutting Concerns

**Goal:** logging and access checks via middleware/interceptors.

- [ ] **Request logging middleware** — log method, URL, status code, response time:
  ```typescript
  // src/common/middleware/logging.middleware.ts
  @Injectable()
  export class LoggingMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) { ... }
  }
  ```
  Apply in `AppModule` via `configure(consumer: MiddlewareConsumer)`.

- [ ] Ensure global `ValidationPipe` is in place (from Stage 0)
- [ ] `ParseUUIDPipe` used consistently in all controllers for `:id` params

---

## Stage 7 — Swagger / OpenAPI

**Goal:** full API documentation at `/doc` for +16 points.

- [ ] Swagger setup in `main.ts` (from Stage 0)
- [ ] Add `@ApiTags('users')` / `@ApiTags('articles')` etc. to each controller
- [ ] Add `@ApiOperation({ summary: '...' })` to each handler
- [ ] Add `@ApiResponse({ status: 200, ... })`, `@ApiResponse({ status: 404, ... })` etc.
- [ ] Add `@ApiProperty()` decorators to DTO fields
- [ ] Verify `GET /doc` renders all 4 resource groups

---

## Stage 8 — README

**Goal:** +10 points for a proper README.

Required sections:
1. **Description** — what the project does
2. **Requirements** — Node.js version, etc.
3. **Installation** — `npm install`
4. **Configuration** — `.env` variables (`PORT`)
5. **Running** — `npm start` / `npm run start:dev`
6. **API Overview** — list of endpoints grouped by resource
7. **Testing** — how to run `npm test`

---

## Stage 9 (Bonus) — Hacker Scope

**Goal:** +30 extra points.

### Pagination (+10)

Add `page` and `limit` query params to all list endpoints.

Response shape:
```json
{
  "total": 42,
  "page": 1,
  "limit": 10,
  "data": [...]
}
```

Create a reusable `PaginationDto`:
```typescript
export class PaginationDto {
  @IsInt() @Min(1) @IsOptional() @Type(() => Number) page?: number = 1;
  @IsInt() @Min(1) @Max(100) @IsOptional() @Type(() => Number) limit?: number = 10;
}
```

### Sorting (+10)

Add `sortBy` and `order` query params to all list endpoints.

```
GET /article?sortBy=createdAt&order=desc
GET /user?sortBy=login&order=asc
```

### Additional automated tests (+10)

Write unit tests for services or e2e tests for article/category/comment endpoints (Jest + Supertest).

---

## Score Tracking

| Item | Points | Done |
|------|--------|------|
| README.md | +10 | [ ] |
| User module (controller/service/module) | +10 | [ ] |
| Article module | +10 | [ ] |
| Category module | +10 | [ ] |
| Comment module | +10 | [ ] |
| Each passing test | +10 each | [ ] |
| DTO validation (all resources) | +16 | [ ] |
| Article filtering (status/categoryId/tag) | +10 | [ ] |
| OpenAPI/Swagger at `/doc` | +16 | [ ] |
| Cascading deletes | +10 | [ ] |
| Pagination | +10 | [ ] |
| Sorting | +10 | [ ] |
| Additional tests | +10 | [ ] |

---

## Things to Watch Out For (Forfeits)

- **-20** No separate development branch → work in `develop`, open PR to `main`
- **-20** No Pull Request → create PR when done
- **-10** PR description is incorrect → write a proper PR description
- **-20** Less than 3 meaningful commits → commit after each stage
- **-10** per lint error → run `npm run lint` before submitting
- **-670** Changes in test files → **never modify files in `test/`**
