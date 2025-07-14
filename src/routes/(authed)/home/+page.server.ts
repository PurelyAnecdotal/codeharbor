import { tagged, wrapDB, wrapDockerode, type Tagged } from '$lib/error';
import { getGitHubUserInfo } from '$lib/octokit';
import { getOkResultAsyncs, wrapUndefined } from '$lib/result';
import { db } from '$lib/server/db';
import { workspace } from '$lib/server/db/schema';
import { docker } from '$lib/server/docker.js';
import type {
	ContainerState,
	GitHubUserInfo,
	Uuid,
	WorkspaceContainerInfo,
	WorkspaceDBEntry
} from '$lib/types';
import { redirect } from '@sveltejs/kit';
import type Dockerode from 'dockerode';
import type { ContainerInfo } from 'dockerode';
import { eq, or, sql } from 'drizzle-orm';
import { err, errAsync, ok, Result, ResultAsync } from 'neverthrow';

export async function load({ locals }) {
	const { user } = locals;

	if (!user) redirect(307, '/');

	return {
		workspaces: (await getWorkspaces(user.uuid, user.ghAccessToken)).orTee(console.error)
	};
}

const getWorkspaceDBEntries = (userUuid: Uuid) =>
	wrapDB(
		db
			.select()
			.from(workspace)
			.where(
				or(
					eq(workspace.ownerUuid, userUuid),
					sql`EXISTS (
							SELECT 1 FROM json_each(${workspace.sharedUserUuids}) 
							WHERE value = ${userUuid}
						)`
				)
			)
	).map((res): WorkspaceDBEntry[] => res);

const getContainersList = () => wrapDockerode(docker.listContainers({ all: true }));

const getWorkspaces = (userUuid: Uuid, accessToken: string) =>
	getWorkspaceDBEntries(userUuid).andThen((dbWorkspaces) =>
		getContainersList().map((containersList) =>
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

		ResultAsync.fromPromise(db.delete(workspace).where(eq(workspace.uuid, uuid)), (err) =>
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

	const sharedUsersInfoPromise = getGitHubUserNameInfos(
		workspaceDBEntry.sharedUserUuids,
		accessToken
	);

	const ownerInfoPromise = getGitHubUserInfo(workspaceDBEntry.ownerUuid, accessToken).unwrapOr(
		undefined
	);

	return ResultAsync.fromSafePromise(
		sharedUsersInfoPromise.then((sharedUsersInfo) =>
			ownerInfoPromise.then(
				(ownerInfo): WorkspaceContainerInfo => ({
					...workspaceDBEntry,
					state,
					url,
					sharedUsersInfo,
					ownerInfo
				})
			)
		)
	);

	// return ResultAsync.fromSafePromise(
	// 	(async () =>
	// 		({
	// 			...workspaceDBEntry,
	// 			state,
	// 			url,
	// 			sharedUsersInfo: await sharedUsersInfoPromise,
	// 			ownerInfo: await ownerInfoPromise
	// 		}) satisfies WorkspaceContainerInfo)()
	// );
}

async function getGitHubUserNameInfos(userUuids: Uuid[], accessToken: string) {
	return new Map(
		(
			await Promise.all(
				userUuids
					.map(
						(userUuid) =>
							[userUuid, getGitHubUserInfo(userUuid, accessToken).unwrapOr(undefined)] as const
					)
					.map(async ([id, promise]) => {
						const userInfo = await promise;
						return userInfo ? ([id, userInfo] as const) : undefined;
					})
			)
		).filter((entry): entry is readonly [Uuid, GitHubUserInfo] => entry !== undefined)
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
