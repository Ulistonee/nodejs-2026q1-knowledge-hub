# Knowledge Hub

Backend на **NestJS**: статьи и метаданные в **PostgreSQL**, REST API с JWT. Есть **RAG** — чанкинг статей, эмбеддинги и генерация ответов через **Google Gemini**, векторный индекс в **Qdrant** (гибридный поиск: семантика + полнотекстовый PostgreSQL). Дополнительно: другие AI-эндпоинты под `/ai`.

## Запуск

```bash
cp .env.example .env
# в .env: GEMINI_API_KEY

docker compose up --build
```

API: `http://localhost:4000`.


```bash
npm install && npx prisma migrate deploy && npm run prisma:seed
```

## RAG (curl)

```bash
export BASE=http://localhost:4000

BASE=http://localhost:4000
LOGIN=ragdemo
PASSWORD=secret123

curl -s -X POST "$BASE/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"login\":\"$LOGIN\",\"password\":\"$PASSWORD\"}"

curl -s -X POST "$BASE/auth/login" \
-H "Content-Type: application/json" \
-d "{\"login\":\"$LOGIN\",\"password\":\"$PASSWORD\"}"

TOKEN=вставь_сюда_accessToken_целиком

curl -sS "$BASE/health"

curl -sS -X POST "$BASE/ai/rag/index" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"onlyPublished":true}'

curl -sS -X POST "$BASE/ai/rag/index" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"onlyPublished":true,"updatedAfter":"2026-01-01T00:00:00.000Z"}'

curl -sS -X POST "$BASE/ai/rag/search" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"query":"текст запроса","limit":5}'

curl -sS -X POST "$BASE/ai/rag/search" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"query":"nodejs","limit":10,"hybrid":false}'

curl -sS -X POST "$BASE/ai/rag/chat" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"question":"Вопрос по корпусу"}'

# CONV — conversationId из ответа chat
export CONV='<uuid>'
curl -sS -X POST "$BASE/ai/rag/chat" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"question\":\"Уточнение\",\"conversationId\":\"$CONV\"}"

curl -sS "$BASE/ai/rag/chat/$CONV/history" -H "Authorization: Bearer $TOKEN"

curl -sS -X DELETE "$BASE/ai/rag/index/articles/<uuid-статьи>" \
  -H "Authorization: Bearer $TOKEN" -w "\n%{http_code}\n"
```
