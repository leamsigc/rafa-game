# syntax=docker/dockerfile:1

##
## Build stage — compile the Vite client + bundle the Express server.
##
FROM node:22-alpine AS build
WORKDIR /app

# pnpm via corepack, pinned to the version that generated pnpm-lock.yaml.
# (pnpm 12+ makes unapproved build scripts a hard error; 10 only warns.)
RUN corepack enable && corepack prepare pnpm@10.34.5 --activate

# Install dependencies first for better layer caching.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build the client (dist/) and the bundled server (dist/server.cjs).
# NODE_ENV must NOT be "production" here — server.ts only runs `vite build`
# via the npm script; the production branch is only hit at runtime.
COPY . .
RUN npm run build


##
## Runtime stage — only what's needed to run dist/server.cjs.
##
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@10.34.5 --activate

# Re-install production deps so the bundled server's external requires
# (express, ws, @google/genai, dotenv, vite) resolve at runtime.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Bring in the built client + bundled server from the build stage.
COPY --from=build /app/dist ./dist

# Default port (matches docker-compose.yml); Coolify can override via PORT.
ENV PORT=3000
EXPOSE 3000

# Coolify reads this to report container health (wget ships in busybox).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-3000}/api/health | grep -q '"status":"ok"' || exit 1

# Run as the unprivileged node user (image ships one).
USER node

CMD ["node", "dist/server.cjs"]
