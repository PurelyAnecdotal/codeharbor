import { useDB } from '$lib/server/db';
import { workspaces, workspacesToSharedUsers } from '$lib/server/db/schema';
import { jsonGroupArray } from '$lib/server/db/utils';
import { isUuid } from '$lib/types';
import { eq } from 'drizzle-orm';

export async function GET({ locals, params }) {
	if (locals.user === null) return new Response('Unauthorized', { status: 401 });

	const authedUserUuid = locals.user.uuid;
	const workspaceUuid = params.uuid;

	if (!isUuid(workspaceUuid)) return new Response('Invalid workspace UUID format', { status: 400 });

	const workspaceSelectResult = await useDB((db) =>
		db
			.select({
				ownerUuid: workspaces.ownerUuid,
				dockerId: workspaces.dockerId,
				sharedUserUuids: jsonGroupArray(workspacesToSharedUsers.userUuid)
			})
			.from(workspaces)
			.where(eq(workspaces.uuid, workspaceUuid))
			.leftJoin(workspacesToSharedUsers, eq(workspaces.uuid, workspacesToSharedUsers.workspaceUuid))
	).map((res) => res[0]);

	if (workspaceSelectResult.isErr()) return new Response('Database Error', { status: 500 });

	if (workspaceSelectResult.value === undefined)
		return new Response('Workspace not found', { status: 404 });

	const { ownerUuid, sharedUserUuids } = workspaceSelectResult.value;

	const hasAccess = ownerUuid === authedUserUuid || sharedUserUuids.includes(authedUserUuid);

	return new Response(hasAccess.toString());
}
