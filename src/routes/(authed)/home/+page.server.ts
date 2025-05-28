import { requireLogin } from '$lib/auth.js';
import { db } from '$lib/server/db';
import { workspaces } from '$lib/server/db/schema';
import { docker } from '$lib/server/docker.js';
import type { ContainerInfo } from 'dockerode';
import { eq } from 'drizzle-orm';

interface DBWorkspace {
	uuid: string;
	name: string;
	ownerId: number;
	dockerId: string;
	repoURL: string;
}

export type ContainerState =
	| 'created'
	| 'running'
	| 'paused'
	| 'restarting'
	| 'exited'
	| 'removing'
	| 'dead';

export interface WorkspaceContainer extends DBWorkspace {
	url?: string;
	state: ContainerState;
}

export async function load() {
	const session = await requireLogin();

	const userWorkspaces: DBWorkspace[] = await db
		.select()
		.from(workspaces)
		.where(eq(workspaces.ownerId, session.id!));

	const containersInfo = await docker.listContainers({ all: true });

	const accessibleUserWorkspaces: WorkspaceContainer[] = (
		await Promise.allSettled(
			userWorkspaces.map((workspace) => getContainer(workspace, containersInfo))
		)
	)
		.filter((result) => result.status === 'fulfilled')
		.map((result) => result.value);

	return { workspaces: accessibleUserWorkspaces };
}

async function getContainer(
	workspace: DBWorkspace,
	containersInfo: ContainerInfo[]
): Promise<WorkspaceContainer> {
	const { dockerId, uuid } = workspace;

	const containerInfo = containersInfo.find((c) => c.Id === dockerId);

	if (!containerInfo) {
		await db.delete(workspaces).where(eq(workspaces.uuid, uuid));
		throw new Error(`Container ${dockerId} not found; workspace ${uuid} removed from database.`);
	}

	const bridgeIP = containerInfo.NetworkSettings.Networks['bridge'].IPAddress;

	const accessUrl =
		bridgeIP && containerInfo.State === 'running'
			? `http://${bridgeIP}:3000/?folder=/config/workspace`
			: undefined;

	return {
		...workspace,
		url: accessUrl,
		state: containerInfo.State as ContainerState
	};
}
