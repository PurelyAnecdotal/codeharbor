import { useDB } from '$lib/server/db';
import { workspaces } from '$lib/server/db/schema';
import { containerRemove } from '$lib/server/docker';
import { validateWorkspaceAccess } from '$lib/server/workspaces';
import { isUuid } from '$lib/types';
import { eq } from 'drizzle-orm';

export async function DELETE({ locals, params }) {
	if (locals.user === null) return new Response('Unauthorized', { status: 401 });

	const authedUserUuid = locals.user.uuid;
	const workspaceUuid = params.uuid;

	if (!isUuid(workspaceUuid)) return new Response('Invalid workspace UUID format', { status: 400 });

	const validationResult = await validateWorkspaceAccess(authedUserUuid, workspaceUuid);
	if (validationResult.isErr()) return validationResult.error;
	const { dockerId } = validationResult.value;

	const dockerResult = await containerRemove(dockerId);

	if (dockerResult.isErr()) {
		console.error('Failed to remove container:', dockerResult.error);
		return new Response('Failed to remove container', { status: 500 });
	}

	const dbDeleteResult = await useDB((db) =>
		db.delete(workspaces).where(eq(workspaces.uuid, workspaceUuid))
	);

	if (dbDeleteResult.isErr()) {
		console.error('Failed to delete workspace from database:', dbDeleteResult.error);
		return new Response('Failed to delete workspace from database', { status: 500 });
	}

	return new Response('Workspace deleted', { status: 200 });
}
