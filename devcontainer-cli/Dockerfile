FROM oven/bun:alpine AS base

RUN apk add --no-cache docker-cli

RUN bun install -g @devcontainers/cli

ENTRYPOINT ["devcontainer"]