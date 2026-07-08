FROM node:22-alpine AS base
RUN apk add --no-cache ffmpeg
RUN npm install -g pnpm@10.0.0

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/discord-recorder/package.json ./apps/discord-recorder/
COPY shared/ ./shared/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/discord-recorder/node_modules ./apps/discord-recorder/node_modules
COPY . .
RUN pnpm --filter @ai-dungeon-master-recorder/discord-recorder run build

FROM node:22-alpine AS runner
RUN apk add --no-cache ffmpeg
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/discord-recorder/dist ./apps/discord-recorder/dist
COPY --from=builder /app/apps/discord-recorder/package.json ./apps/discord-recorder/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/discord-recorder/node_modules ./apps/discord-recorder/node_modules
COPY --from=builder /app/storage ./storage

WORKDIR /app/apps/discord-recorder
CMD ["node", "dist/index.js"]
