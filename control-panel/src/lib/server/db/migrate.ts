import { drizzle } from 'drizzle-orm/bun-sqlite';
import Database from 'bun:sqlite';
import { workspaces } from './schema';
import { isNull } from 'drizzle-orm';

const db = drizzle(new Database(process.env.DATABASE_URL!));

await db
	.update(workspaces)
	.set({ lastAccessedAt: new Date() })
	.where(isNull(workspaces.lastAccessedAt));
