# ShahrJo API - production image (Phase 13/14).
# Build context is the repo root: docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable

# Dependency layer (cached unless lockfiles change)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/config/package.json packages/config/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile

# Source + build
COPY . .
RUN pnpm exec prisma generate
RUN pnpm --filter @shahrjo/api build

FROM node:22-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /repo /repo
RUN mkdir -p /repo/apps/api/uploads && chown -R node:node /repo/apps/api/uploads

WORKDIR /repo/apps/api
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
