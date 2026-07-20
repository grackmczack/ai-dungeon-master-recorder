FROM node:22-alpine AS base
RUN npm install -g pnpm@10.0.0

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/frontend/package.json ./apps/frontend/
COPY shared/ ./shared/
RUN pnpm install --frozen-lockfile || pnpm install

FROM base AS builder
WORKDIR /app
ARG VITE_GTM_CONTAINER_ID=""
ARG VITE_GTM_SERVER_URL=""
ENV VITE_GTM_CONTAINER_ID=${VITE_GTM_CONTAINER_ID}
ENV VITE_GTM_SERVER_URL=${VITE_GTM_SERVER_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/frontend/node_modules ./apps/frontend/node_modules
COPY . .
WORKDIR /app/apps/frontend
RUN pnpm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/frontend/build /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
