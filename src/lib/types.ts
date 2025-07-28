export type Uuid = `${string}-${string}-${string}-${string}-${string}`;

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuid = (str: string): str is Uuid => uuidRegex.test(str);

// overrides Dockerode.ContainerInfo.State
export type ContainerState =
	| 'created'
	| 'running'
	| 'paused'
	| 'restarting'
	| 'exited'
	| 'removing'
	| 'dead';

export interface WorkspaceDBEntry {
	uuid: Uuid;
	name: string;
	ownerUuid: Uuid;
	dockerId: string;
	repoURL: string;
	folder: string;
	sharedUserUuids: Uuid[];
}

export interface GitHubUserInfo {
	id: number;
	login: string;
	name: string | null;
}

export interface WorkspaceContainerInfo extends WorkspaceDBEntry {
	url?: string;
	state: ContainerState;
	ownerInfo?: GitHubUserInfo;
	sharedUsersInfo: Map<Uuid, GitHubUserInfo>;
	cpuUsage?: number;
	memoryUsage?: number;
	cpusLimit?: number;
	memoryLimitGiB?: number;
}
