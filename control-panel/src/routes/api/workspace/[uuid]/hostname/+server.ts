import { dockerNetworkName } from '$lib/server/config';
import { useDB } from '$lib/server/db';
import { workspaces, workspacesToSharedUsers } from '$lib/server/db/schema';
import { jsonGroupArray } from '$lib/server/db/utils';
import { containerInspect } from '$lib/server/docker';
import { isUuid } from '$lib/types';
import { eq } from 'drizzle-orm';

export async function GET({ locals, params, url }) {
	const search = new URLSearchParams(url.search);
	const inContainer = search.get('inContainer') === 'true';

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

	if (workspaceSelectResult.isErr()) {
		console.error(workspaceSelectResult.error);
		return new Response('Database Error', { status: 500 });
	}

	const workspaceData = workspaceSelectResult.value;
	if (workspaceData === undefined) return new Response('Workspace not found', { status: 404 });

	const { ownerUuid, sharedUserUuids, dockerId } = workspaceData;

	if (ownerUuid !== authedUserUuid && !sharedUserUuids.includes(authedUserUuid))
		return new Response('Forbidden', { status: 403 });

	const inspectResult = await containerInspect(dockerId);

	if (inspectResult.isErr()) {
		console.error(inspectResult.error);
		return new Response('Error inspecting docker container', { status: 500 });
	}

	const inspectInfo = inspectResult.value;

	if (!inspectInfo.State.Running) 
		return new Response('Container is not running', { status: 500 });

	if (inContainer) return new Response(inspectInfo.Name.replace('/', ''));

	const network = inspectInfo.NetworkSettings.Networks[dockerNetworkName];
	if (network) {
		if (network.IPAddress === '') return new Response('Container has no IP address (Is it running?)', { status: 500 });
		return new Response(network.IPAddress);
	}

	console.error(`Docker network '${dockerNetworkName}' not found on container ${dockerId}`);
	return new Response(`Docker network '${dockerNetworkName}' not found on container`, {
		status: 500
	});
}
