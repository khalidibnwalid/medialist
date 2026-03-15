# used as a reference:
# - https://nextjs.org/docs/pages/building-your-application/deploying#docker-image
# - https://stackoverflow.com/questions/78034830#78034830

FROM node:20.9-alpine AS base

# 1. Install dependencies only when needed
FROM base AS deps

# better-sqlite3 dependencies
RUN apk add --no-cache \
    python3 \
    sqlite\
    make\
    g++

USER node
WORKDIR /app
COPY --chown=node:node package*.json ./

USER root
RUN npm ci --omit=dev

# 2. Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .

ENV NODE_ENV=production

RUN npm run build

# 3. Production image, copy needed files
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Migration packages
RUN npm install drizzle-kit drizzle-orm

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Migration files
COPY --from=builder --chown=node:node /app/src/server/db/migrations ./src/server/db/migrations
COPY --from=builder --chown=node:node /app/drizzle.config.ts ./drizzle.config.ts

COPY --from=builder --chown=node:node /app/scripts/recover.js ./scripts/recover.js

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "npm run db:migrate && node server.js"]