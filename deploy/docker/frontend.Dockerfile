# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:24.20.0-bookworm-slim
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.30.4-alpine

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,id=sigvits-frontend-npm,target=/root/.npm,sharing=locked \
    npm ci --ignore-scripts --no-audit --no-fund
COPY frontend/angular.json frontend/tsconfig.json frontend/tsconfig.app.json ./
COPY frontend/public ./public
COPY frontend/src ./src
RUN npm run build -- --configuration production

FROM ${NGINX_IMAGE} AS runtime
USER root
RUN apk --no-cache upgrade \
    && apk add --no-cache jq
COPY deploy/docker/nginx.conf /etc/nginx/nginx.conf
COPY deploy/docker/frontend.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build --chown=101:101 /app/dist/frontend/browser /usr/share/nginx/html
COPY --chmod=0555 deploy/docker/write-runtime-config.sh /docker-entrypoint.d/40-write-runtime-config.sh
RUN mkdir -p /usr/share/nginx/html/config \
    && chown -R 101:101 /usr/share/nginx/html/config /var/cache/nginx /var/run
ENV NGINX_ENVSUBST_FILTER='^(SIGVITS_API_ORIGIN|SUPABASE_URL)$'
USER 101
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
