FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/discord-recorder/package.json apps/discord-recorder/package.json
RUN pnpm install --filter @ai-dungeon-master-recorder/discord-recorder... --no-frozen-lockfile

COPY apps/discord-recorder apps/discord-recorder
# Install TypeScript in the specific package for build
RUN pnpm add -D --filter @ai-dungeon-master-recorder/discord-recorder typescript
RUN pnpm --filter @ai-dungeon-master-recorder/discord-recorder build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY apps/discord-recorder/package.json apps/discord-recorder/package.json
RUN pnpm install --filter @ai-dungeon-master-recorder/discord-recorder --prod --no-frozen-lockfile

COPY --from=build /app/apps/discord-recorder/dist apps/discord-recorder/dist

# Create recordings directory
RUN mkdir -p /app/storage/recordings

WORKDIR /app/apps/discord-recorder

# Copy .env file if it exists (will be overridden by docker-compose)
COPY apps/discord-recorder/.env.example .env

CMD ["node", "dist/index.js"]
