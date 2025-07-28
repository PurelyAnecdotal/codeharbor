import { db } from '$lib/server/db/index';
import { workspacesToSharedUsers } from '$lib/server/db/schema';
import { validateWorkspaceAccess } from '$lib/server/workspaces';
import { isUuid } from '$lib/types';
import { and, eq } from 'drizzle-orm';

export async function PUT({ locals, params }) {
	if (locals.user === null) return new Response('Unauthorized', { status: 401 });

	const authedUserUuid = locals.user.uuid;
	const workspaceUuid = params.uuid;
	const userUuidToShare = params.userUUID;

	if (!isUuid(workspaceUuid)) return new Response('Invalid workspace UUID format', { status: 400 });
	if (!isUuid(userUuidToShare)) return new Response('Invalid user UUID format', { status: 400 });

	const validationResult = await validateWorkspaceAccess(authedUserUuid, workspaceUuid);
	if (validationResult.isErr()) return validationResult.error;
	const { sharedUserUuids, ownerUuid } = validationResult.value;

	if (sharedUserUuids.includes(userUuidToShare))
		return new Response('Workspace has already been shared with user', { status: 400 });

	if (ownerUuid === userUuidToShare)
		return new Response('Cannot share workspace with owner', { status: 400 });

	await db.insert(workspacesToSharedUsers).values({ userUuid: userUuidToShare, workspaceUuid });

	return new Response('Workspace shared with user', { status: 200 });
}

export async function DELETE({ locals, params }) {
	if (locals.user === null) return new Response('Unauthorized', { status: 401 });

	const authedUserUuid = locals.user.uuid;
	const workspaceUuid = params.uuid;
	const userUuidToUnshare = params.userUUID;

	if (!isUuid(workspaceUuid)) return new Response('Invalid workspace UUID format', { status: 400 });
	if (!isUuid(userUuidToUnshare)) return new Response('Invalid user UUID format', { status: 400 });

	const validationResult = await validateWorkspaceAccess(authedUserUuid, workspaceUuid);
	if (validationResult.isErr()) return validationResult.error;
	const { sharedUserUuids, ownerUuid } = validationResult.value;

	if (!sharedUserUuids.includes(userUuidToUnshare))
		return new Response('User does not have access', { status: 400 });

	if (ownerUuid === userUuidToUnshare)
		return new Response('Cannot remove access from owner', { status: 400 });

	await db
		.delete(workspacesToSharedUsers)
		.where(
			and(
				eq(workspacesToSharedUsers.workspaceUuid, workspaceUuid),
				eq(workspacesToSharedUsers.userUuid, userUuidToUnshare)
			)
		);

	return new Response('Workspace unshared with user', { status: 200 });
}
