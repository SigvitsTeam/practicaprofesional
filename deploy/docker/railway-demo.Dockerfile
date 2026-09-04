# Demo: API y worker comparten un servicio y su directorio de exportaciones.
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY backend/nest-cli.json backend/tsconfig.json backend/tsconfig.build.json backend/tsconfig.worker.json backend/prisma.config.ts ./
COPY backend/prisma ./prisma
COPY backend/src ./src
RUN npm run build && npm run build:worker && cp -R dist/assets dist-worker/assets
RUN npm prune --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production EXPORT_STORAGE_DIRECTORY=/var/lib/sigvits/exports
ENV NODE_EXTRA_CA_CERTS=/app/certs/prod-ca-2021.crt
COPY deploy/certs/prod-ca-2021.crt /app/certs/prod-ca-2021.crt
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates tini && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/dist-worker ./dist-worker
COPY --chown=node:node deploy/docker/run-demo.mjs ./run-demo.mjs
COPY --chmod=0555 deploy/docker/backend-entrypoint.sh /usr/local/bin/sigvits-entrypoint
RUN mkdir -p /var/lib/sigvits/exports && chown node:node /var/lib/sigvits/exports
USER node
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "-s", "--", "/usr/local/bin/sigvits-entrypoint"]
CMD ["node", "run-demo.mjs"]
