import { relations } from 'drizzle-orm';
import { integer, numeric, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

type Uuid = `${string}-${string}-${string}-${string}-${string}`;
const uuid = () => text({ length: 36 }).$type<Uuid>();

export const users = sqliteTable('users', {
	uuid: uuid().primaryKey(),
	name: text(),
	ghId: integer().notNull().unique(),
	ghLogin: text().notNull().unique(),
	updatedAt: integer()
		.notNull()
		.$defaultFn(() => Date.now()),
	ghAccessToken: text().notNull()
});

export const usersRelations = relations(users, ({ many }) => ({
	userToGroups: many(usersToGroups)
}));

export const groups = sqliteTable('groups', {
	uuid: uuid().primaryKey(),
	admin: integer({ mode: 'boolean' }).notNull().default(false)
});

export const groupsRelations = relations(groups, ({ many }) => ({
	usersToGroups: many(usersToGroups)
}));

export const usersToGroups = sqliteTable(
	'users_to_groups',
	{
		userUuid: uuid()
			.notNull()
			.references(() => users.uuid),
		groupUuid: uuid()
			.notNull()
			.references(() => groups.uuid)
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
	uuid: uuid().primaryKey(),
	name: text().notNull(),
	ownerUuid: uuid()
		.notNull()
		.references(() => users.uuid),
	dockerId: text({ length: 64 }).notNull().unique(),
	// repoURL: text().notNull(),
	folder: text().notNull(),
	templateUuid: uuid().references(() => templates.uuid)
});

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
	owner: one(users, {
		fields: [workspaces.ownerUuid],
		references: [users.uuid]
	}),
	template: one(templates, {
		fields: [workspaces.templateUuid],
		references: [templates.uuid]
	}),
	workspacesToSharedUsers: many(workspacesToSharedUsers)
}));

export const workspacesToSharedUsers = sqliteTable(
	'workspaces_to_shared_users',
	{
		workspaceUuid: uuid()
			.notNull()
			.references(() => workspaces.uuid),
		userUuid: uuid()
			.notNull()
			.references(() => users.uuid)
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

export const templates = sqliteTable('templates', {
	uuid: uuid().primaryKey(),
	name: text().notNull(),
	description: text(),
	ownerUuid: uuid()
		.notNull()
		.references(() => users.uuid),
	createdAt: integer({ mode: 'timestamp' }).notNull(),
	ghRepoOwner: text().notNull(),
	ghRepoName: text().notNull(),
	suggestedCpusLimit: numeric({ mode: 'number' }).notNull().default(1),
	suggestedMemoryLimitGiB: numeric({ mode: 'number' }).notNull().default(1)
});

export const templatesRelations = relations(templates, ({ one }) => ({
	owner: one(users, {
		fields: [templates.ownerUuid],
		references: [users.uuid]
	})
}));

export const groupsToTemplates = sqliteTable(
	'groups_to_templates',
	{
		groupUuid: uuid()
			.notNull()
			.references(() => groups.uuid),
		templateUuid: uuid()
			.notNull()
			.references(() => templates.uuid)
	},
	(table) => [primaryKey({ columns: [table.groupUuid, table.templateUuid] })]
);

export const groupsToTemplatesRelations = relations(groupsToTemplates, ({ one }) => ({
	group: one(groups, {
		fields: [groupsToTemplates.groupUuid],
		references: [groups.uuid]
	}),
	template: one(templates, {
		fields: [groupsToTemplates.templateUuid],
		references: [templates.uuid]
	})
}));

export const sessions = sqliteTable('sessions', {
	id: text().primaryKey(),
	userUuid: uuid()
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

export const blockedUsers = sqliteTable('blocked_users', {
	ghId: integer().primaryKey()
});

export type Session = typeof sessions.$inferSelect;
export type User = typeof users.$inferSelect;
