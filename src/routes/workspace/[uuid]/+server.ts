import { db } from '$lib/server/db/index.js';
import { workspaces } from '$lib/server/db/schema.js';
import { docker } from '$lib/server/docker.js';
import { eq } from 'drizzle-orm';

export async function DELETE({ locals, params }) {
	const session = await locals.auth();

	if (!session || !session.id || !session.accessToken)
		return new Response('Unauthorized', { status: 401 });

	const dbRes = await db
		.select({
			ownerId: workspaces.ownerId,
			dockerId: workspaces.dockerId
		})
		.from(workspaces)
		.where(eq(workspaces.uuid, params.uuid));

	if (dbRes.length === 0) return new Response('Workspace not found', { status: 404 });

	const workspace = dbRes[0];

	if (workspace.ownerId !== session.id) return new Response('Forbidden', { status: 403 });

	await docker.getContainer(workspace.dockerId).remove();

	await db.delete(workspaces).where(eq(workspaces.uuid, params.uuid));

	return new Response('Workspace deleted', { status: 200 });
}
