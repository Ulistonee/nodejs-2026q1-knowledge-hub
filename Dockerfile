FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:24-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && \
    rm -rf \
      node_modules/prisma \
      node_modules/@prisma/studio-core \
      node_modules/@prisma/dev \
      node_modules/@prisma/engines \
      node_modules/effect \
      node_modules/@electric-sql \
      node_modules/typescript \
      node_modules/react-dom \
      node_modules/scheduler \
      node_modules/chart.js \
      node_modules/remeda \
      node_modules/hono
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/dist ./dist
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
EXPOSE 4000
CMD ["node", "dist/src/main.js"]
