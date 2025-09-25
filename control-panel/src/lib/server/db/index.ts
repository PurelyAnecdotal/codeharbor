import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { catchWithTag, tagged } from '$lib/error';
import type { InferAsyncOk } from '$lib/result';
import * as schema from '$lib/server/db/schema';
import { databaseUrl } from '$lib/server/env';
import Database from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { err, ok, Result, safeTry } from 'neverthrow';

const openSqliteDatabase = Result.fromThrowable(
	(...props: ConstructorParameters<typeof Database>) => new Database(...props),
	(err) => tagged('BunDatabaseOpenError', err)
);

const initDrizzle = Result.fromThrowable(drizzle, (err) => tagged('DrizzleInitError', err));

export const dbResult = safeTry(async function* () {
	if (building) return err(tagged('DatabaseUnavailableError'));

	if (databaseUrl === undefined) return err(tagged('DatabaseUrlNotSet'));

	const databaseExists = await Bun.file(databaseUrl).exists();
	if (!databaseExists) return err(tagged('DatabaseNotFoundError'));

	// the { create:false } option should be used in this case, but is currently broken
	// see https://github.com/oven-sh/bun/issues/15876
	const client = yield* openSqliteDatabase(env.DATABASE_URL).orTee((err) => {
		console.error(err);
		console.error(
			'Failed to open database.\nMake sure you have created the database and set the \n    DATABASE_URL (for development) or\n    DATABASE_DIR (for compose deployment)\nenvironment variable correctly.'
		);
	});

	const db = yield* initDrizzle(client, { schema });

	return ok(db);
});

export const wrapDB = <T>(dbPromise: PromiseLike<T>) => catchWithTag(dbPromise, 'DBError');

// Utility function if not already accessing in safeTry
export const useDB = <T>(dbPromise: (db: InferAsyncOk<typeof dbResult>) => PromiseLike<T>) =>
	dbResult.andThen((db) => wrapDB(dbPromise(db)));
