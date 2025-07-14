import { tagged } from '$lib/error.js';
import { db } from '$lib/server/db/index.js';
import * as table from '$lib/server/db/schema.js';
import { isUuid } from '$lib/types';
import { eq } from 'drizzle-orm';
import { ResultAsync } from 'neverthrow';

export async function PUT({ locals, params }) {
	const { user } = locals;

	if (!user) return new Response('Unauthorized', { status: 401 });

	if (!isUuid(params.uuid) || !isUuid(params.userUUID))
		return new Response('Invalid UUID format', { status: 400 });

	const dbSelectResult = await ResultAsync.fromPromise(
		db
			.select({
				ownerUuid: table.workspace.ownerUuid,
				sharedUserUuids: table.workspace.sharedUserUuids,
				dockerId: table.workspace.dockerId
			})
			.from(table.workspace)
			.where(eq(table.workspace.uuid, params.uuid)),
		(err) => tagged('DBError', err)
	);

	if (dbSelectResult.isErr()) return new Response('Database Error', { status: 500 });

	const dbResponse = dbSelectResult.value;

	if (dbResponse.length === 0 || !dbResponse[0])
		return new Response('Workspace not found', { status: 404 });

	const workspace = dbResponse[0];

	if (workspace.ownerUuid !== user.uuid && !workspace.sharedUserUuids.includes(user.uuid))
		return new Response('Forbidden', { status: 403 });

	if (workspace.sharedUserUuids.includes(user.uuid))
		return new Response('User already has access', { status: 400 });

	if (workspace.ownerUuid === user.uuid)
		return new Response('Cannot share workspace with owner', { status: 400 });

	db.update(table.workspace)
		.set({
			sharedUserUuids: [...workspace.sharedUserUuids, user.uuid]
		})
		.where(eq(table.workspace.uuid, params.uuid));

	return new Response('Workspace shared with user', { status: 200 });
}

export async function DELETE({ locals, params }) {
	const { user } = locals;

	if (!user) return new Response('Unauthorized', { status: 401 });

	if (!isUuid(params.uuid) || !isUuid(params.userUUID))
		return new Response('Invalid UUID format', { status: 400 });

	const dbSelectResult = await ResultAsync.fromPromise(
		db
			.select({
				ownerUuid: table.workspace.ownerUuid,
				sharedUserUuids: table.workspace.sharedUserUuids,
				dockerId: table.workspace.dockerId
			})
			.from(table.workspace)
			.where(eq(table.workspace.uuid, params.uuid)),
		(err) => tagged('DBError', err)
	);

	if (dbSelectResult.isErr()) return new Response('Database Error', { status: 500 });

	const dbResponse = dbSelectResult.value;

	if (dbResponse.length === 0 || !dbResponse[0])
		return new Response('Workspace not found', { status: 404 });

	const workspace = dbResponse[0];

	if (workspace.ownerUuid !== user.uuid && !workspace.sharedUserUuids.includes(user.uuid))
		return new Response('Forbidden', { status: 403 });

	if (!workspace.sharedUserUuids.includes(user.uuid))
		return new Response('User does not have access', { status: 400 });

	if (workspace.ownerUuid === user.uuid)
		return new Response('Cannot remove access from owner', { status: 400 });

	db.update(table.workspace)
		.set({
			sharedUserUuids: workspace.sharedUserUuids.filter((id) => id !== user.uuid)
		})
		.where(eq(table.workspace.uuid, params.uuid));

	return new Response('Workspace access removed for user', { status: 200 });
}
