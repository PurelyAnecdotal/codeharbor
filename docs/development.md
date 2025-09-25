# Development

## Set .env files

### Control Panel `control-panel/.env`
- AUTH_GITHUB_ID
- AUTH_GTIHUB_SECRET
- DATABASE_URL
- OPENVSCODE_SERVER_MOUNT_PATH
- DOCKER_GROUP_ID
- DOCKER_SOCKET_PATH

### Gateway `gateway/.env`
- DATABASE_URL
- GATEWAY_ROOT_DOMAIN
- CONTROL_PANEL_HOST

## Run dev server
In control-panel:
`bun run -b dev --host