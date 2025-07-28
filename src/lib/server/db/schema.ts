import type { Uuid } from '$lib/types';
import { relations } from 'drizzle-orm';
import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
	uuid: text({ length: 36 }).primaryKey().$type<Uuid>(),
	ghId: integer().notNull().unique(),
	ghLogin: text().notNull().unique(),
	ghName: text(),
	updatedAt: integer()
		.notNull()
		.$defaultFn(() => Date.now()),
	ghAccessToken: text().notNull()
});

export const usersRelations = relations(users, ({ many }) => ({
	userToGroups: many(usersToGroups)
}));

export const groups = sqliteTable('groups', {
	uuid: text({ length: 36 }).primaryKey().$type<Uuid>(),
	admin: integer({ mode: 'boolean' }).notNull().default(false)
});

export const groupsRelations = relations(groups, ({ many }) => ({
	usersToGroups: many(usersToGroups)
}));

export const usersToGroups = sqliteTable(
	'users_to_groups',
	{
		userUuid: text({ length: 36 })
			.notNull()
			.references(() => users.uuid)
			.$type<Uuid>(),
		groupUuid: text({ length: 36 })
			.notNull()
			.references(() => groups.uuid)
			.$type<Uuid>()
	},
	(table) => [primaryKey({ columns: [table.userUuid, table.groupUuid] })]
);

export const usersToGroupsRelations = relations(usersToGroups, ({ one }) => ({
	group: one(groups, {
		fields: [usersToGroups.groupUuid],
		references: [groups.uuid]
	}),
	user: one(users, {
		fields: [usersToGroups.userUuid],
		references: [users.uuid]
	})
}));

export const workspaces = sqliteTable('workspaces', {
	uuid: text({ length: 36 }).primaryKey().$type<Uuid>(),
	name: text().notNull(),
	ownerUuid: text({ length: 36 })
		.notNull()
		.references(() => users.uuid)
		.$type<Uuid>(),
	dockerId: text({ length: 64 }).notNull().unique(),
	repoURL: text().notNull(),
	folder: text().notNull()
});

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
	owner: one(users, {
		fields: [workspaces.ownerUuid],
		references: [users.uuid]
	}),
	workspacesToSharedUsers: many(workspacesToSharedUsers)
}));

export const workspacesToSharedUsers = sqliteTable(
	'workspaces_to_shared_users',
	{
		workspaceUuid: text({ length: 36 })
			.notNull()
			.references(() => workspaces.uuid)
			.$type<Uuid>(),
		userUuid: text({ length: 36 })
			.notNull()
			.references(() => users.uuid)
			.$type<Uuid>()
	},
	(table) => [primaryKey({ columns: [table.workspaceUuid, table.userUuid] })]
);

export const workspacesToSharedUsersRelations = relations(workspacesToSharedUsers, ({ one }) => ({
	workspace: one(workspaces, {
		fields: [workspacesToSharedUsers.workspaceUuid],
		references: [workspaces.uuid]
	}),
	user: one(users, {
		fields: [workspacesToSharedUsers.userUuid],
		references: [users.uuid]
	})
}));

export const sessions = sqliteTable('sessions', {
	id: text().primaryKey(),
	userUuid: text()
		.notNull()
		.references(() => users.uuid),
	expiresAt: integer({ mode: 'timestamp' }).notNull()
});

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, {
		fields: [sessions.userUuid],
		references: [users.uuid]
	})
}));

export type Session = typeof sessions.$inferSelect;
export type User = typeof users.$inferSelect;
