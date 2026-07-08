FROM node:22-alpine AS base
RUN npm install -g pnpm@10.0.0

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/discord-recorder/package.json ./apps/discord-recorder/
COPY shared/ ./shared/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY . .
RUN pnpm --filter @ai-dungeon-master-recorder/backend run db:generate
RUN pnpm --filter @ai-dungeon-master-recorder/backend run build

FROM node:22-alpine AS runner
RUN npm install -g pnpm@10.0.0
WORKDIR /app
ENV NODE_ENV=production
ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node

COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/package.json ./apps/backend/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/node_modules ./apps/backend/node_modules

WORKDIR /app/apps/backend
EXPOSE 3001
CMD ["node", "dist/index.js"]
