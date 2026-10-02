# ShahrJo Web - Next.js production image (Phase 3).
# Build context is the repo root: docker build -f apps/web/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
ENV NEXT_TELEMETRY_DISABLED=1
# /api rewrite target — serialized into the routes manifest at build time.
ARG INTERNAL_API_URL=http://127.0.0.1:4000
ENV INTERNAL_API_URL=${INTERNAL_API_URL}

# Dependency layer (cached unless lockfiles change)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY packages/config/package.json packages/config/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile

# Source + build (standalone output: pruned server + traced node_modules)
COPY . .
RUN pnpm --filter @shahrjo/web build

FROM node:22-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN corepack enable

COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
