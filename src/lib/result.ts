import { err, ok, Result, ResultAsync } from 'neverthrow';
import type { ZodError, ZodSafeParseResult } from 'zod';

export const resultAllSettled = <T, E>(resultAsyncs: ResultAsync<T, E>[]) =>
	Promise.allSettled(resultAsyncs).then((allSettledRes) =>
		allSettledRes
			.filter((settledRes) => settledRes.status === 'fulfilled')
			.map((fulfilledRes) => fulfilledRes.value)
	);

export const getOkResultAsyncs = <T, E>(resultAsyncs: ResultAsync<T, E>[]) =>
	resultAllSettled(resultAsyncs).then((results) =>
		results.filter((result) => result.isOk()).map((result) => result.value)
	);

export const wrapUndefined = <T, E>(value: T | undefined, undefinedError: E): Result<T, E> =>
	value !== undefined ? ok(value) : err(undefinedError);

export const zResult = <T>(parsed: ZodSafeParseResult<T>): Result<T, ZodError<T>> =>
	parsed.success ? ok(parsed.data) : err(parsed.error);

export type InferOk<R> = R extends Result<infer T, unknown> ? T : never;

export type InferAsyncOk<R> = R extends ResultAsync<infer T, unknown> ? T : never;

export type InferErr<R> = R extends Result<unknown, infer E> ? E : never;

export type InferAsyncErr<R> = R extends ResultAsync<unknown, infer E> ? E : never;
