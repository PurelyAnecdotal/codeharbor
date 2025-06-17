import type { Result } from 'neverthrow';

export interface DBError extends Error {}

export interface DockerodeError2 {
	statusCode: number;
	json: {
		message: string;
	};
}

export interface DockerodeError extends Error {
	code: string;
	path: string;
	errno: number;
}

interface MaskedError {
	_tag: 'MaskedError';
	message: string;
}

export const MaskedError = (message: string): MaskedError => ({
	_tag: 'MaskedError',
	message
});

export const maskResult = <T, E>(result: Result<T, E>) =>
	result.mapErr((err) => {
		console.error('Caught: ', err);
		return MaskedError('Something went wrong');
	});

export const isMaskedError = (error: unknown): error is MaskedError =>
	error !== null && typeof error === 'object' && '_tag' in error && error._tag === 'MaskedError';
