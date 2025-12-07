import { isTagged, tagged } from '$lib/error';
import type { Transport } from '@sveltejs/kit';
import { parse, stringify } from 'devalue';
import { err, Err, ok, Ok } from 'neverthrow';

export const transport: Transport = {
	Ok: {
		encode: (maybeOk: unknown) => {
			if (!(maybeOk instanceof Ok)) return false;

			return stringify(maybeOk.value);
		},
		decode: (value: string) => ok(parse(value))
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

			return stringify(rest);
		},
		decode: (value: string) => err(parse(value))
	},
	Tagged: {
		encode: (maybeTagged: unknown): string | false => {
			if (!isTagged(maybeTagged)) return false;

			const { cause, ...rest } = maybeTagged;

			return stringify(rest);
		},
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		decode: (value: string) => parse(value)
	}
};
