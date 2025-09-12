FROM oven/bun:alpine AS base
WORKDIR /usr/src/app

FROM base AS install
RUN mkdir -p /temp/dev/gateway
RUN mkdir -p /temp/dev/control-panel
RUN mkdir -p /temp/dev/patches
COPY package.json bun.lock /temp/dev/
COPY gateway/package.json /temp/dev/gateway
COPY control-panel/package.json /temp/dev/control-panel
COPY patches /temp/dev/patches
RUN cd /temp/dev && bun install --frozen-lockfile --filter "./control-panel"

RUN mkdir -p /temp/prod/gateway
RUN mkdir -p /temp/prod/control-panel
RUN mkdir -p /temp/prod/patches
COPY package.json bun.lock /temp/prod/
COPY gateway/package.json /temp/prod/gateway
COPY control-panel/package.json /temp/prod/control-panel
COPY patches /temp/prod/patches
RUN cd /temp/prod && bun install --production --filter "./control-panel"

FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY control-panel .
COPY control-panel/build.env .env

ENV NODE_ENV=production
RUN bun run -b build

FROM base AS release
# COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/build .

USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "." ]