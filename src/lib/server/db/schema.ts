import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const workspaces = sqliteTable('workspace', {
	uuid: text({ length: 36 }).primaryKey(),
	name: text().notNull(),
	ownerId: integer().notNull(),
	dockerId: text({ length: 64 }).notNull().unique(),
	repoURL: text().notNull(),
	folder: text().notNull(),
	sharedIds: text({ mode: 'json' }).default('[]').notNull().$type<number[]>(),
});
