FROM oven/bun:alpine AS base
WORKDIR /usr/src/app

FROM base AS install
RUN mkdir -p /temp/dev/patches
COPY package.json bun.lock /temp/dev/
COPY patches /temp/dev/patches
RUN cd /temp/dev && bun install --frozen-lockfile

FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .
COPY build.env .env

ENV NODE_ENV=production
RUN bun run -b build

FROM base AS release
COPY --from=prerelease /usr/src/app/build .

USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "." ]