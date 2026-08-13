ARG NODE_VERSION=24.18.0

FROM node:${NODE_VERSION}-bookworm-slim AS base

ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

WORKDIR /app

RUN groupadd --gid 10001 app \
  && useradd --uid 10001 --gid app --create-home --shell /usr/sbin/nologin app \
  && mkdir -p /app/node_modules /app/source \
  && chown -R app:app /app

COPY package.json package-lock.json* ./

FROM base AS dependencies
USER app
RUN npm ci --ignore-scripts --no-audit --no-fund

FROM dependencies AS development
COPY --chown=app:app . /app/source
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM dependencies AS build
COPY --chown=app:app . .
RUN npm run build
