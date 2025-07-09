import { err, ok, Result, ResultAsync } from 'neverthrow';

const resultAllSettled = <T, E>(resultAsyncs: ResultAsync<T, E>[]) =>
	ResultAsync.fromSafePromise(Promise.allSettled(resultAsyncs)).map((allSettledRes) =>
		allSettledRes
			.filter((settledRes) => settledRes.status === 'fulfilled')
			.map((fulfilledRes) => fulfilledRes.value)
	);

export const getOkResultAsyncs = <T, E>(resultAsyncs: ResultAsync<T, E>[]) =>
	resultAllSettled(resultAsyncs).map((results) =>
		results.filter((result) => result.isOk()).map((result) => result.value)
	);

export const wrapUndefined = <T, E>(value: T | undefined, undefinedError: E): Result<T, E> =>
	value !== undefined ? ok(value) : err(undefinedError);
