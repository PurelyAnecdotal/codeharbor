import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const workspaces = sqliteTable('workspace', {
	uuid: text('uuid', { length: 36 }).primaryKey(),
	name: text('name').notNull(),
	ownerId: integer('owner_id').notNull(),
	dockerId: text('docker_id', { length: 64 }).notNull().unique(),
	repoURL: text('repo_url', { length: 256 }).notNull(),
});
