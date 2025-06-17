import { isMaskedError, MaskedError } from '$lib/error';
import type { Transport } from '@sveltejs/kit';
import { err, Err, ok, Ok } from 'neverthrow';

export const transport: Transport = {
	Ok: {
		encode: (maybeOk: unknown) => maybeOk instanceof Ok && maybeOk.value,
		decode: (value: unknown) => ok(value)
	},
	Err: {
		encode: (maybeErr: unknown): string | false => {
			if (!(maybeErr instanceof Err)) return false;

			const error: unknown = maybeErr.error;

			if (!isMaskedError(error)) {
				console.error('Attempted to encode an unmasked error:', error);
				return 'Something went wrong';
			}

			return error.message;
		},
		decode: (value: string) => err(MaskedError(value))
	}
};
