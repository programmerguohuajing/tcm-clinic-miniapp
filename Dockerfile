FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY packages/admin-shared/package.json packages/admin-shared/package.json

RUN corepack enable && pnpm install --frozen-lockfile

# Copy backend source
COPY backend backend
COPY packages packages

# Copy pre-built PC admin SPA (built locally before docker build)
COPY pc-admin/dist ./pc-admin/dist

EXPOSE 3000

CMD ["pnpm", "start:api"]
