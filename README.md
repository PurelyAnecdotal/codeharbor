# CodeHarbor

Self-hosted GitHub Codespaces alternative designed for education

## Setup
1. Clone this repository
2. [Create GitHub OAuth App](docs/github-oauth.md)
3. [Download openvscode-server](docs/vscode-server.md)
4. [Create database](docs/db-migrations.md)
5. [Set environment variables](docs/environment-variables.md)
6. Create compose.yaml from [template](compose.template.yaml)
7. Pull runtime images: `docker image pull` for `cgr.dev/chainguard/git:latest` and `mcr.microsoft.com/devcontainers/base:ubuntu`
8. Run `docker network create codeharbor`
9. Run `docker compose up -d`