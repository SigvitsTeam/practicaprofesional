# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:24.20.0-bookworm-slim

FROM ${NODE_IMAGE} AS development-dependencies
WORKDIR /app
RUN apt-get update \
    && apt-get upgrade --yes --no-install-recommends \
    && apt-get install --yes --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
COPY backend/package.json backend/package-lock.json ./
RUN --mount=type=cache,id=sigvits-backend-npm,target=/root/.npm,sharing=locked \
    npm ci --ignore-scripts --no-audit --no-fund

FROM development-dependencies AS build
COPY backend/nest-cli.json backend/tsconfig.json backend/tsconfig.build.json ./
COPY backend/tsconfig.worker.json backend/prisma.config.ts ./
COPY backend/prisma ./prisma
COPY backend/src ./src
RUN npm run db:generate \
    && npm run build \
    && npm run build:worker \
    && cp -R dist/assets dist-worker/assets

FROM ${NODE_IMAGE} AS production-dependencies
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN --mount=type=cache,id=sigvits-backend-npm,target=/root/.npm,sharing=locked \
    npm ci --omit=dev --ignore-scripts --no-audit --no-fund

FROM ${NODE_IMAGE} AS runtime-base
ENV NODE_ENV=production \
    NODE_OPTIONS=--enable-source-maps
WORKDIR /app
RUN apt-get update \
    && apt-get upgrade --yes --no-install-recommends \
    && apt-get install --yes --no-install-recommends ca-certificates tini \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/local/lib/node_modules/npm /opt/yarn-v1.22.22 \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=production-dependencies --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/dist-worker ./dist-worker
COPY --chmod=0555 deploy/docker/backend-entrypoint.sh /usr/local/bin/sigvits-entrypoint
RUN mkdir -p /var/lib/sigvits/exports \
    && chown node:node /var/lib/sigvits/exports
USER node
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/sigvits-entrypoint"]

FROM runtime-base AS api
EXPOSE 3000
CMD ["node", "dist/main.js"]

FROM runtime-base AS worker
CMD ["node", "dist-worker/export-worker.js"]

FROM build AS migrator
ENV NODE_ENV=production
COPY --chmod=0555 deploy/docker/backend-entrypoint.sh /usr/local/bin/sigvits-entrypoint
RUN rm -rf /usr/local/lib/node_modules/npm /opt/yarn-v1.22.22 \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/yarn /usr/local/bin/yarnpkg
USER node
ENTRYPOINT ["/usr/local/bin/sigvits-entrypoint"]
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]
