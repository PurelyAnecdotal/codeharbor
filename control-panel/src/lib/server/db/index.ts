import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import Database from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';

export let db: ReturnType<typeof drizzle<typeof schema>>;

if (!building) {
	const client = new Database(env.DATABASE_URL);

	db = drizzle(client, { schema });
}
