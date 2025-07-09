import { requireLogin } from '$lib/auth.js';
import { tagged, type Tagged } from '$lib/error';
import { getGitHubUsername } from '$lib/octokit';
import { getOkResultAsyncs, wrapUndefined } from '$lib/result';
import { db } from '$lib/server/db';
import { workspaces } from '$lib/server/db/schema';
import { docker } from '$lib/server/docker.js';
import type { ContainerState, WorkspaceContainerInfo, WorkspaceDBEntry } from '$lib/types';
import type Dockerode from 'dockerode';
import type { ContainerInfo } from 'dockerode';
import { eq, or, sql } from 'drizzle-orm';
import { err, errAsync, ok, okAsync, Result, ResultAsync } from 'neverthrow';

export async function load() {
	const session = await requireLogin();

	return { workspaces: await getWorkspaces(session.id!, session.accessToken!) };
}

const getWorkspaceDBEntries = (
	userId: number
): ResultAsync<WorkspaceDBEntry[], Tagged<'DBError'>> =>
	ResultAsync.fromPromise(
		db
			.select()
			.from(workspaces)
			.where(
				or(
					eq(workspaces.ownerId, userId),
					sql`EXISTS (
							SELECT 1 FROM json_each(${workspaces.sharedIds}) 
							WHERE value = ${userId}
						)`
				)
			),
		(err) => tagged('DBError', err)
	);

const getContainersList = () =>
	ResultAsync.fromPromise(docker.listContainers({ all: true }), (err) =>
		tagged('DockerodeError', err)
	);

const getWorkspaces = (userId: number, accessToken: string) =>
	getWorkspaceDBEntries(userId).andThen((dbWorkspaces) =>
		getContainersList().andThen((containersList) =>
			getOkResultAsyncs(
				dbWorkspaces.map((workspace) =>
					getWorkspaceContainerInfo(workspace, containersList, accessToken)
				)
			)
		)
	);

function getWorkspaceContainerInfo(
	workspaceDBEntry: WorkspaceDBEntry,
	containersInfo: ContainerInfo[],
	accessToken: string
): ResultAsync<WorkspaceContainerInfo, Tagged<'ContainerNotFoundError'>> {
	const { dockerId, uuid, folder } = workspaceDBEntry;

	const containerInfo = containersInfo.find((c) => c.Id === dockerId);

	if (!containerInfo) {
		console.warn(`Container ${dockerId} not found; removing workspace ${uuid} from database.`);

		ResultAsync.fromPromise(db.delete(workspaces).where(eq(workspaces.uuid, uuid)), (err) =>
			tagged('DBError', err)
		).orTee((err) => console.error('Failed to remove workspace ${uuid} from database: ', err));

		return errAsync(tagged('ContainerNotFoundError'));
	}

	const state = containerInfo.State as ContainerState;

	const runningResult: Result<void, Tagged<'ContainerNotRunningError'>> = state === 'running'
		? ok()
		: err(tagged('ContainerNotRunningError'));

	const url = runningResult
		.andThen(() =>
			wrapUndefined(
				containerInfo.NetworkSettings.Networks['bridge'],
				tagged('BridgeNetworkNotFoundError')
			)
		)
		.map((network) => `http://${network.IPAddress}:3000/?folder=${folder}`)
		.unwrapOr(undefined);

	return getGitHubUsername(workspaceDBEntry.ownerId, accessToken)
		.map(({ name, login }) => ({
			...workspaceDBEntry,
			state,
			url,
			ownerName: name,
			ownerLogin: login
		}))
		.orElse(() =>
			okAsync({
				...workspaceDBEntry,
				state,
				url
			})
		);
}

const getContainerStats = (dockerId: string) =>
	ResultAsync.fromPromise(docker.getContainer(dockerId).stats({ stream: false }), (err) =>
		tagged('DockerodeError', err)
	);

function calculateContainerResourceUsage({
	cpu_stats,
	precpu_stats,
	memory_stats
}: Dockerode.ContainerStats) {
	const cpuDelta = cpu_stats.cpu_usage.total_usage - precpu_stats.cpu_usage.total_usage;
	const systemCpuDelta = cpu_stats.system_cpu_usage - precpu_stats.system_cpu_usage;

	const usedMemory = memory_stats.usage - memory_stats.stats.cache;

	return {
		cpuUsage: (cpuDelta / systemCpuDelta) * cpu_stats.online_cpus * 100,
		memoryUsage: (usedMemory / memory_stats.limit) * 100
	};
}
