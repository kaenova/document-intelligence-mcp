# syntax=docker/dockerfile:1

FROM oven/bun:1.3.14-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    MCP_HOST=0.0.0.0 \
    MCP_PORT=8080

# Install production dependencies only (lockfile-pinned).
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Bun runs the TypeScript sources directly; no compile step required.
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN mkdir -p /app/.cache && chown -R bun:bun /app
USER bun

EXPOSE 8080

# FastMCP exposes public liveness (/health) and readiness (/ready) probes.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health >/dev/null || exit 1

CMD ["bun", "run", "src/index.ts"]
