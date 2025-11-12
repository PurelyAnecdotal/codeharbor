import { useDB } from '$lib/server/db';
import { workspaces, workspacesToSharedUsers } from '$lib/server/db/schema';
import { jsonGroupArray } from '$lib/server/db/utils';
import { isUuid } from '$lib/types';
import { eq } from 'drizzle-orm';

export async function PATCH({ locals, params }) {
	if (locals.user === null) return new Response('Unauthorized', { status: 401 });

	const authedUserUuid = locals.user.uuid;
	const workspaceUuid = params.uuid;

	if (!isUuid(workspaceUuid)) return new Response('Invalid workspace UUID format', { status: 400 });

	const workspaceSelectResult = await useDB((db) =>
		db
			.select({
				ownerUuid: workspaces.ownerUuid,
				sharedUserUuids: jsonGroupArray(workspacesToSharedUsers.userUuid)
			})
			.from(workspaces)
			.where(eq(workspaces.uuid, workspaceUuid))
			.leftJoin(workspacesToSharedUsers, eq(workspaces.uuid, workspacesToSharedUsers.workspaceUuid))
	).map((res) => res[0]);

	if (workspaceSelectResult.isErr()) {
		console.error(workspaceSelectResult.error);
		return new Response('Database Error', { status: 500 });
	}

	const workspaceData = workspaceSelectResult.value;
	if (workspaceData === undefined) return new Response('Workspace not found', { status: 404 });

	const { ownerUuid, sharedUserUuids } = workspaceData;

	if (ownerUuid !== authedUserUuid && !sharedUserUuids.includes(authedUserUuid))
		return new Response('Forbidden', { status: 403 });

    const currentTime = new Date();

	const updateResult = await useDB((db) =>
		db
			.update(workspaces)
			.set({ lastAccessedAt: currentTime })
			.where(eq(workspaces.uuid, workspaceUuid))
	);

	if (updateResult.isErr()) {
		console.error(updateResult.error);
		return new Response('Error updating lastAccessedAt time', { status: 500 });
	}

	return new Response(currentTime.getTime().toString());
}
