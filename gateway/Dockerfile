FROM oven/bun:alpine AS base
WORKDIR /usr/src/app

FROM base AS install
RUN mkdir -p /temp/prod/gateway
RUN mkdir -p /temp/prod/control-panel
RUN mkdir -p /temp/prod/patches
COPY package.json bun.lock /temp/prod/
COPY gateway/package.json /temp/prod/gateway
COPY control-panel/package.json /temp/prod/control-panel
COPY patches /temp/prod/patches
RUN cd /temp/prod && bun install --production --filter "./gateway"

FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY gateway/src src
COPY gateway/package.json .
COPY control-panel/src/lib/server/db/schema.ts src/schema.ts

USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "src/index.ts" ]
