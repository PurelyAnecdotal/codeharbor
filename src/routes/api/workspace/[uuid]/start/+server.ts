import { containerStart } from '$lib/server/docker';
import { validateWorkspaceAccess } from '$lib/server/workspaces';
import { isUuid } from '$lib/types';

export async function POST({ locals, params }) {
	if (locals.user === null) return new Response('Unauthorized', { status: 401 });

	const authedUserUuid = locals.user.uuid;
	const workspaceUuid = params.uuid;

	if (!isUuid(workspaceUuid)) return new Response('Invalid workspace UUID format', { status: 400 });

	const validationResult = await validateWorkspaceAccess(authedUserUuid, workspaceUuid);
	if (validationResult.isErr()) return validationResult.error;
	const { dockerId } = validationResult.value;

	const dockerResult = await containerStart(dockerId);

	if (dockerResult.isErr()) {
		console.error('Failed to start container:', dockerResult.error);
		return new Response('Failed to start container', { status: 500 });
	}

	return new Response('Workspace started', { status: 200 });
}
