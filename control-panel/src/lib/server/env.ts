import { env } from '$env/dynamic/private';

export const githubOAuthClientId: string | undefined = env.AUTH_GITHUB_ID;
export const githubOAuthClientSecret: string | undefined = env.AUTH_GTIHUB_SECRET;
export const databaseUrl: string | undefined = env.DATABASE_URL;
export const openvscodeServerMountPath: string | undefined = env.OPENVSCODE_SERVER_MOUNT_PATH;
export const dockerSocketPath: string | undefined = env.DOCKER_SOCKET_PATH;
