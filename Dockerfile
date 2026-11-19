# syntax=docker/dockerfile:1
FROM node:22.21.1-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
COPY package.json ./
# Corepack installs the pnpm version named in package.json ("packageManager").
RUN corepack enable && corepack prepare --activate

FROM base AS deps
COPY pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The project has no public folder yet; this keeps the copy in the runner stage working.
RUN mkdir -p public
# The env file comes in as a BuildKit secret: it is mounted only during this RUN and is not stored in any layer.
# Next.js copies .env into the standalone folder; it is removed in the same RUN so no layer keeps it.
RUN --mount=type=secret,id=appenv,target=/app/.env pnpm build && rm -f .next/standalone/.env

FROM node:22.21.1-slim AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd --gid 1001 app && useradd --uid 1001 --gid app --no-create-home app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/src/content ./src/content
USER app
EXPOSE 3000
CMD ["node", "server.js"]
