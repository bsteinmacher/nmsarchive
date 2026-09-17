FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
ENV DATABASE_URL="file:../data/nmsarchive.db"
RUN npm ci

FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
ENV DATABASE_URL="file:../data/nmsarchive.db"
RUN npm ci --omit=dev

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:../data/nmsarchive.db"
RUN mkdir -p /app/data
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:../data/nmsarchive.db"
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# uid 1000 (`node`) casa com o usuário típico do host. Não usar 1001:
# chown no bind mount ./data quebrava o `npm run dev` (SQLite 1544 readonly).
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --chown=node:node docker-entrypoint.sh /app/docker-entrypoint.sh

RUN chmod +x /app/docker-entrypoint.sh \
  && mkdir -p /app/data/backups /app/data/screenshots \
  && chown -R node:node /app/data /app/prisma

USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
