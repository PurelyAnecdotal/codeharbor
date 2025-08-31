import { defineConfig } from 'drizzle-kit';
import { env } from 'bun';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'sqlite',
	dbCredentials: { url: env.DATABASE_URL },
	verbose: true,
	strict: true
});
