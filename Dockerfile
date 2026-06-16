FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY pc-admin/package.json pc-admin/package.json
COPY packages/admin-shared/package.json packages/admin-shared/package.json

RUN pnpm install --frozen-lockfile

COPY backend backend
COPY packages packages
COPY pc-admin pc-admin

RUN pnpm build:pc

EXPOSE 3000

CMD ["pnpm", "start:api"]
