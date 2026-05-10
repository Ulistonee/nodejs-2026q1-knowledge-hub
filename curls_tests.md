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

curl -s -X POST "$BASE/ai/rag/index" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"onlyPublished":true}'

curl -s -X POST "$BASE/ai/rag/index" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"onlyPublished":true,"articleIds":["11111111-1111-4111-8111-111111111111","22222222-2222-4222-8222-222222222222"]}'

curl -s -X POST "$BASE/ai/rag/index" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"onlyPublished":false}'

curl -s -X POST "$BASE/ai/rag/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"твой запрос текстом","limit":5}'

curl -s -X POST "$BASE/ai/rag/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"nodejs","limit":10,"status":"published","categoryId":"33333333-3333-4333-8333-333333333333","tags":["docs"]}'

curl -s -X POST "$BASE/ai/rag/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"question":"Кратко: о чём релевантные статьи?"}'

  CONV=вставь_conversationId_из_JSON_ответа


Чат (продолжение) — подставь conversationId из прошлого ответа:

curl -s -X POST "$BASE/ai/rag/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"question\":\"Уточни детали\",\"conversationId\":\"$CONV\",\"status\":\"published\"}"