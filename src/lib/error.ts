import { ResultAsync } from "neverthrow";

const errorMessages = {
	UnknownError: 'An unknown error occurred',
	DBError: 'Error contacting database',
	DockerodeError: 'Error communicating with Docker',
	ContainerNotFoundError: 'Container not found',
	ContainerNotRunningError: 'Container is not running',
	OctokitError: 'Error communicating with GitHub',
	RequestValidationError: 'Request validation failed',
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

export const wrapDB = <T>(dbPromise: PromiseLike<T>) =>
	ResultAsync.fromPromise(dbPromise, (err) => tagged('DBError', err));

export const wrapDockerode = <T>(dockerodePromise: PromiseLike<T>) =>
	ResultAsync.fromPromise(dockerodePromise, (err) => tagged('DockerodeError', err));

export const wrapOctokit = <T>(octokitPromise: PromiseLike<T>) =>
	ResultAsync.fromPromise(octokitPromise, (err) => tagged('OctokitError', err));