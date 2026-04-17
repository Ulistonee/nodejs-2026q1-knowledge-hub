FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

FROM node:24-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
RUN rm -rf \
      node_modules/prisma \
      node_modules/@prisma/studio-core \
      node_modules/@prisma/dev \
      node_modules/@prisma/engines \
      node_modules/@prisma/fetch-engine \
      node_modules/@prisma/internals \
      node_modules/typescript \
      node_modules/react \
      node_modules/react-dom \
      node_modules/scheduler \
      node_modules/@types
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
EXPOSE 4000
CMD ["node", "dist/src/main.js"]
