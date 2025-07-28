import { wrapDB } from '$lib/error';
import { db } from '$lib/server/db';
import { workspaces, workspacesToSharedUsers } from '$lib/server/db/schema';
import type { Uuid } from '$lib/types';
import {
	eq,
	getTableColumns,
	inArray,
	sql,
	type ColumnBaseConfig,
	type ColumnDataType
} from 'drizzle-orm';
import { union, type SQLiteColumn } from 'drizzle-orm/sqlite-core';

export const getWorkspaceSharedUsers = (workspaceUuid: Uuid) =>
	wrapDB(
		db
			.select({
				sharedUserUuids: sql<Uuid[]>`json_group_array(${workspacesToSharedUsers.userUuid})`
			})
			.from(workspacesToSharedUsers)
			.where(eq(workspacesToSharedUsers.workspaceUuid, workspaceUuid))
			.groupBy(workspacesToSharedUsers.workspaceUuid)
	).map((v) => v[0]?.sharedUserUuids ?? []);

const getAccessibleWorkspacesWithSharedUsersUnsafe = async (userUuid: Uuid) => {
	const accessibleWorkspaces = await union(
		db.select({ uuid: workspaces.uuid }).from(workspaces).where(eq(workspaces.ownerUuid, userUuid)),
		db
			.select({ uuid: workspaces.uuid })
			.from(workspaces)
			.innerJoin(
				workspacesToSharedUsers,
				eq(workspaces.uuid, workspacesToSharedUsers.workspaceUuid)
			)
			.where(eq(workspacesToSharedUsers.userUuid, userUuid))
	);

	const uuids = accessibleWorkspaces.map((x) => x.uuid);

	const workspacesWithSharedUsers = await db
		.select({
			...getTableColumns(workspaces),
			sharedUserUuids: jsonGroupArray(workspacesToSharedUsers.userUuid)
		})
		.from(workspaces)
		.where(inArray(workspaces.uuid, uuids))
		.leftJoin(workspacesToSharedUsers, eq(workspacesToSharedUsers.workspaceUuid, workspaces.uuid))
		.groupBy(workspaces.uuid);

	return workspacesWithSharedUsers;
};

export const getAccessibleWorkspacesWithSharedUsers = (userUuid: Uuid) =>
	wrapDB(getAccessibleWorkspacesWithSharedUsersUnsafe(userUuid));

export const jsonGroupArray = <T extends ColumnBaseConfig<ColumnDataType, string>>(
	column: SQLiteColumn<T>
) => sql`json_group_array(${column})`.mapWith((data) => parseSqliteJson<T['data'][]>(data));

const parseSqliteJson = <T = unknown>(data: string): T => {
	const value: T = JSON.parse(data);

	if (Array.isArray(value) && value.length === 1 && value[0] === null) return [] as T;

	return value;
};
