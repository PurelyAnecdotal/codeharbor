import { requireLogin } from '$lib/auth.js';
import { maskResult, type DBError, type DockerodeError } from '$lib/error';
import { db } from '$lib/server/db';
import { workspaces } from '$lib/server/db/schema';
import { docker } from '$lib/server/docker.js';
import type { ContainerInfo } from 'dockerode';
import { eq } from 'drizzle-orm';
import { err, ok, Result, ResultAsync } from 'neverthrow';

export type ContainerState =
	| 'created'
	| 'running'
	| 'paused'
	| 'restarting'
	| 'exited'
	| 'removing'
	| 'dead';

interface WorkspaceDBEntry {
	uuid: string;
	name: string;
	ownerId: number;
	dockerId: string;
	repoURL: string;
	folder: string;
}

export interface WorkspaceContainer extends WorkspaceDBEntry {
	url?: string;
	state: ContainerState;
}

export async function load() {
	const session = await requireLogin();

	return { workspaces: maskResult(await getUserWorkspaces(session.id!)) };
}

const getUserDBWorkspaces = (id: number) =>
	ResultAsync.fromPromise(
		db.select().from(workspaces).where(eq(workspaces.ownerId, id!)),
		(err) => err as DBError
	);

const getContainersList = () =>
	ResultAsync.fromPromise(docker.listContainers({ all: true }), (err) => err as DockerodeError);

const getUserWorkspaces = (id: number) =>
	getUserDBWorkspaces(id).andThen((dbWorkspaces) =>
		getContainersList().map((containersList) =>
			dbWorkspaces
				.map((workspace) => getContainer(workspace, containersList))
				.filter((result) => result.isOk())
				.map((result) => result.value)
		)
	);

interface ContainerNotFoundError {
	message: 'Container not found';
}

interface ContainerNotRunningError {
	message: 'Container is not running';
}

interface BridgeNetworkNotFoundError {
	message: 'Bridge network not found';
}

function getContainer(
	workspaceDBEntry: WorkspaceDBEntry,
	containersInfo: ContainerInfo[]
): Result<
	WorkspaceContainer,
	ContainerNotFoundError | ContainerNotRunningError | BridgeNetworkNotFoundError
> {
	const { dockerId, uuid, folder } = workspaceDBEntry;

	const containerInfo = containersInfo.find((c) => c.Id === dockerId);

	if (!containerInfo) {
		console.error(`Container ${dockerId} not found; removing workspace ${uuid} from database.`);

		ResultAsync.fromPromise(
			db.delete(workspaces).where(eq(workspaces.uuid, uuid)),
			(err) => err as DBError
		).orTee((err) => console.error('Failed to remove workspace ${uuid} from database: ', err));

		const error: ContainerNotFoundError = { message: 'Container not found' };
		return err(error);
	}

	const state = containerInfo.State as ContainerState;

	const workspaceContainer: WorkspaceContainer = { ...workspaceDBEntry, state };

	if (state !== 'running') return ok(workspaceContainer);

	const bridge = containerInfo.NetworkSettings.Networks['bridge'];

	if (!bridge) {
		const error: BridgeNetworkNotFoundError = { message: 'Bridge network not found' };
		return err(error);
	}

	workspaceContainer.url = `http://${bridge.IPAddress}:3000/?folder=${folder}`;

	return ok(workspaceContainer);
}
