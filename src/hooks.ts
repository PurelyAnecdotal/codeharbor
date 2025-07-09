import { isTagged, tagged } from '$lib/error';
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

			if (!isTagged(error)) {
				console.error('Attempted to encode an untagged error:', error);
				return JSON.stringify(tagged('UnknownError'));
			}

			const { cause, ...rest } = error;

			return JSON.stringify(rest);
		},
		decode: (value: string) => err(JSON.parse(value))
	},
	Tagged: {
		encode: (maybeTagged: unknown): string | false => {
			if (!isTagged(maybeTagged)) return false;

			const { cause, ...rest } = maybeTagged;

			return JSON.stringify(rest);
		},
		decode: (value: string) => JSON.parse(value)
	}
};
