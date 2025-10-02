import { env } from '$env/dynamic/private';

export const githubOAuthClientId: string | undefined = env.AUTH_GITHUB_ID;
export const githubOAuthClientSecret: string | undefined = env.AUTH_GITHUB_SECRET;
export const databaseUrl: string | undefined = env.DATABASE_URL;
export const openvscodeServerMountPath: string | undefined = env.OPENVSCODE_SERVER_MOUNT_PATH;
export const baseDomain: string | undefined = env.BASE_DOMAIN;
export const dockerSocketPath: string | undefined = env.DOCKER_SOCKET_PATH;
export const dockerNetworkName: string | undefined = env.DOCKER_NETWORK_NAME;