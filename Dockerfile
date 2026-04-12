FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && \
    # @prisma/client pulls in prisma CLI and its dev-only sub-dependencies;
    # none of them are used at runtime — remove to shrink the image.
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
COPY --from=build /app/dist ./dist
# Copy generated Prisma client; skip edge/browser-only files not needed in Node.js
COPY --from=build /app/generated ./dist/generated
RUN rm -f \
      dist/generated/prisma/index-browser.js \
      dist/generated/prisma/wasm-edge-light-loader.mjs \
      dist/generated/prisma/wasm-worker-loader.mjs
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
EXPOSE 4000
CMD ["node", "dist/src/main.js"]
