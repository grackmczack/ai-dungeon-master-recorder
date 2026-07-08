FROM node:22-alpine AS base
RUN apk add --no-cache openssl1.1-compat
RUN npm install -g pnpm@10.0.0

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY services/transcriber/package.json ./services/transcriber/
COPY apps/backend/package.json ./apps/backend/
COPY apps/discord-recorder/package.json ./apps/discord-recorder/
COPY shared/ ./shared/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=deps /app/services/transcriber/node_modules ./services/transcriber/node_modules
COPY . .
RUN pnpm --filter @ai-dungeon-master-recorder/backend run db:generate
RUN pnpm --filter @ai-dungeon-master-recorder/transcriber run build

FROM node:22-alpine AS runner
RUN apk add --no-cache openssl1.1-compat
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/transcriber/dist ./services/transcriber/dist
COPY --from=builder /app/services/transcriber/package.json ./services/transcriber/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/transcriber/node_modules ./services/transcriber/node_modules
WORKDIR /app/services/transcriber
CMD ["node", "dist/index.js"]
