# syntax=docker/dockerfile:1
FROM node:24.18.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci --workspace=@cloudops/server --include-workspace-root
COPY server/tsconfig*.json server/
COPY server/src server/src
RUN npm run build --workspace=@cloudops/server

FROM node:24.18.0-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci --omit=dev --workspace=@cloudops/server --include-workspace-root && npm cache clean --force

FROM node:24.18.0-bookworm-slim AS certificates
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
RUN curl --fail --silent --show-error --location https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o /rds-ca.pem

FROM node:24.18.0-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000 DB_SSL_CA_FILE=/app/rds-ca.pem
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=certificates /rds-ca.pem ./rds-ca.pem
COPY server/migrations ./server/migrations
USER node
EXPOSE 3000
STOPSIGNAL SIGTERM
CMD ["node", "server/dist/server.js"]
