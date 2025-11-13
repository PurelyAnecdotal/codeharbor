import { env } from '$env/dynamic/private';

export const baseDomain = env.BASE_DOMAIN ?? 'codeharbor.localhost';
export const dockerSocketPath = env.DOCKER_SOCKET_PATH ?? '/var/run/docker.sock';
export const dockerNetworkName = env.DOCKER_NETWORK_NAME ?? 'codeharbor';

export const githubOAuthClientId: string | undefined = env.AUTH_GITHUB_ID;
export const githubOAuthClientSecret: string | undefined = env.AUTH_GITHUB_SECRET;
export const databaseUrl: string | undefined = env.DATABASE_URL;
export const openvscodeServerMountPath: string | undefined = env.OPENVSCODE_SERVER_MOUNT_PATH;

export const autostopThresholdMs = 1000 * 60 * 5;
export const autostopIntervalMs = 1000 * 60;