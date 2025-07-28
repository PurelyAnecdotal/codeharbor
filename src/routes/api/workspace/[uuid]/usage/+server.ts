import { calculateContainerResourceUsage, containerStats } from '$lib/server/docker';
import { validateWorkspaceAccess } from '$lib/server/workspaces';
import { isUuid } from '$lib/types';

export async function GET({ params, locals }) {
	if (locals.user === null) return new Response('Unauthorized', { status: 401 });

	const authedUserUuid = locals.user.uuid;
	const workspaceUuid = params.uuid;

	if (!isUuid(workspaceUuid)) return new Response('Invalid workspace UUID format', { status: 400 });

	const validationResult = await validateWorkspaceAccess(authedUserUuid, workspaceUuid);
	if (validationResult.isErr()) return validationResult.error;
	const { dockerId } = validationResult.value;

	const dockerResult = await containerStats(dockerId);

	if (dockerResult.isErr()) {
		console.error('Failed to get container stats:', dockerResult.error);
		return new Response('Failed to get container stats', { status: 500 });
	}

	return Response.json(calculateContainerResourceUsage(dockerResult.value));
}
