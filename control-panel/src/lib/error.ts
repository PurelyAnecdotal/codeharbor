import { Result, ResultAsync } from 'neverthrow';

const errorMessages = {
	UnknownError: 'An unknown error occurred',
	DBError: 'Error contacting database',
	DockerodeError: 'Error communicating with Docker',
	ContainerCreateError: 'Failed to create container',
	ContainerStartError: 'Failed to start container',
	ContainerStopError: 'Failed to stop container',
	ContainerRemoveError: 'Failed to remove container',
	ContainerInspectError: 'Failed to inspect container',
	ContainerStatsError: 'Failed to get container stats',
	ContainerWaitError: 'Failed to wait for container',
	ContainersListError: 'Failed to list containers',
	ContainerNotFoundError: 'Container not found',
	ContainerNotRunningError: 'Container is not running',
	OctokitError: 'Error communicating with GitHub',
	OctokitInitError: 'Failed to initialize Octokit',
	RequestValidationError: 'Request validation failed',
	TemplateNotFoundError: 'Template not found',
	GitCloneError: 'Git clone failed',
	WorkspaceNotFoundError: 'Workspace not found',
	WorkspaceAccessError: 'You do not have access to this workspace',
	DockerGroupIdNotSet: 'DOCKER_GROUP_ID environment variable is not set',
	BunDatabaseOpenError: 'Bun failed to open database',
	DrizzleInitError: 'ORM failed to initialize',
	DatabaseUnavailableError: 'Database is unavailable during building',
	DatabaseNotFoundError: 'Database file not found',
	DatabaseUrlNotSet: 'DATABASE_URL environment variable is not set',
	GitHubOAuthClientIdNotSet: 'AUTH_GITHUB_ID environment variable is not set',
	GitHubOAuthClientSecretNotSet: 'AUTH_GITHUB_SECRET environment variable is not set',
	GitHubOAuthUnavailableError: 'GitHub OAuth client is unavailable during building',
	OpenVSCodeServerMountPathNotSet: 'OPENVSCODE_SERVER_MOUNT_PATH environment variable is not set'
} as const;
export type ErrorTypes = keyof typeof errorMessages;

export interface Tagged<Tag extends ErrorTypes> {
	readonly _tag: Tag;
	readonly message: (typeof errorMessages)[Tag];
	readonly cause?: unknown;
}

export const tagged = <Tag extends ErrorTypes>(tag: Tag, cause?: unknown): Tagged<Tag> => ({
	_tag: tag,
	message: errorMessages[tag],
	cause: cause
});

export const isTagged = <Tag extends ErrorTypes>(error: unknown): error is Tagged<Tag> =>
	typeof error === 'object' &&
	error !== null &&
	'_tag' in error &&
	typeof error._tag === 'string' &&
	error._tag in errorMessages &&
	'message' in error &&
	typeof error.message === 'string';

export const hideCause = <Tag extends ErrorTypes>(taggedError: Tagged<Tag>): Tagged<Tag> => ({
	_tag: taggedError._tag,
	message: taggedError.message
});

export const catchWithTag = <T, Tag extends ErrorTypes>(
	promise: PromiseLike<T>,
	tag: Tag
): ResultAsync<T, Tagged<Tag>> => ResultAsync.fromPromise(promise, (err) => tagged(tag, err));

export const wrapDockerode = <T>(dockerodePromise: PromiseLike<T>) =>
	catchWithTag(dockerodePromise, 'DockerodeError');

export const wrapOctokit = <T>(octokitPromise: PromiseLike<T>) =>
	catchWithTag(octokitPromise, 'OctokitError');
