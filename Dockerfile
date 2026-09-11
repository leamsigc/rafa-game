# ---------- Builder: install deps + build frontend + bundle server ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps first (better layer caching).
# No package-lock.json in repo, so use `npm install`.
COPY package.json ./
COPY bun.lock* pnpm-lock.yaml* package-lock.json* ./
RUN npm install

# Copy source and build.
# Produces: dist/ (vite frontend) + dist/server.cjs (bundled express server)
COPY . .
RUN npm run build

# Prune to production-only deps for the runner stage.
# server.cjs is bundled with --packages=external, so externals
# (express, dotenv, ws, @google/genai) must exist at runtime.
RUN npm prune --omit=dev


# ---------- Runner: minimal production image for Coolify ----------
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Needed for HEALTHCHECK (wget is in busybox, no extra install)
# Alpine node image already includes wget.

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# Coolify injects PORT at runtime; default to 3000 to match server.ts
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-3000}/api/health | grep -q '"status":"ok"' || exit 1

CMD ["node", "dist/server.cjs"]
