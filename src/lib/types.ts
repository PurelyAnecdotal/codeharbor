
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
	uuid: string;
	name: string;
	ownerId: number;
	dockerId: string;
	repoURL: string;
	folder: string;
}

export interface WorkspaceContainerInfo extends WorkspaceDBEntry {
	url?: string;
	state: ContainerState;
	// cpuUsage?: number;
	// memoryUsage?: number;
	ownerName?: string | null;
	ownerLogin?: string;
}
