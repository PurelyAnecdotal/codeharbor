export type Uuid = `${string}-${string}-${string}-${string}-${string}`;

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuid = (str: string): str is Uuid => uuidRegex.test(str);

export const nameRegex = /^[a-z ,.'-]{5,30}$/i;
export const letterRegex = /[a-z]+/i;

export const githubRepoCombinedRegex = /^[\w.-]+\/[\w.-]+$/;
export const githubRepoRegex = /^[\w.-]+$/;

// overrides Dockerode.ContainerInfo.State
export type ContainerState =
	| 'created'
	| 'running'
	| 'paused'
	| 'restarting'
	| 'exited'
	| 'removing'
	| 'dead';

export interface GitHubUserInfo {
	id: number;
	login: string;
	name: string | null;
}
