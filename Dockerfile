FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy workspace config first
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy full source before install so pnpm workspace resolves correctly
COPY backend backend
COPY packages packages
COPY pc-admin pc-admin

RUN corepack enable && pnpm install --frozen-lockfile

# Copy pre-built PC admin SPA (built locally, crossorigin stripped)
COPY pc-admin/dist ./pc-admin/dist

# Clean up to reduce image size
RUN rm -rf pc-admin/node_modules pc-admin/src pc-admin/vite.config.js

EXPOSE 3000

CMD ["node", "backend/src/server.js"]
