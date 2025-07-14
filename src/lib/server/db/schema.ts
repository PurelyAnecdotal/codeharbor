import type { Uuid } from '$lib/types';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const workspace = sqliteTable('workspace', {
	uuid: text({ length: 36 }).primaryKey().$type<Uuid>(),
	name: text().notNull(),
	ownerUuid: text({ length: 36 }).notNull().$type<Uuid>(),
	dockerId: text({ length: 64 }).notNull().unique(),
	repoURL: text().notNull(),
	folder: text().notNull(),
	sharedUserUuids: text({ mode: 'json' }).notNull().default([]).$type<Uuid[]>()
});

export const user = sqliteTable('user', {
	uuid: text({ length: 36 })
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID())
		.$type<Uuid>(),
	ghId: integer().notNull().unique(),
	ghLogin: text().notNull().unique(),
	ghName: text(),
	updatedAt: integer()
		.notNull()
		.$defaultFn(() => Date.now()),
	ghAccessToken: text().notNull()
});

export const session = sqliteTable('session', {
	id: text().primaryKey(),
	userUuid: text()
		.notNull()
		.references(() => user.uuid),
	expiresAt: integer({ mode: 'timestamp' }).notNull()
});

export type Session = typeof session.$inferSelect;
export type User = typeof user.$inferSelect;
