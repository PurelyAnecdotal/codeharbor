import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema.js';

export let db: ReturnType<typeof drizzle<typeof schema>> | undefined = undefined;

try {
	if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL environment variable is not set');

	if (!(await Bun.file(process.env.DATABASE_URL).exists()))
		throw new Error('Database file does not exist');

	// the { create: false } option should be used in this case, but is currently broken
	// see https://github.com/oven-sh/bun/issues/15876
	const client = new Database(process.env.DATABASE_URL);

	db = drizzle(client, { schema });
} catch (err) {
	console.error(err);
}
