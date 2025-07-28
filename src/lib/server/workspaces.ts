import { type Tagged, tagged, wrapDB, wrapDockerode } from '$lib/error';
import { getOkResultAsyncs } from '$lib/result';
import { getGitHubUserInfo } from '$lib/server/octokit';
import type { Octokit } from '@octokit/rest';
import type { ContainerInfo } from 'dockerode';
import { eq } from 'drizzle-orm';
import { Result, ResultAsync, err, errAsync, ok } from 'neverthrow';
import {
	type ContainerState,
	type GitHubUserInfo,
	type Uuid,
	type WorkspaceContainerInfo,
	type WorkspaceDBEntry
} from '../types';
import { db } from './db';
import { workspaces } from './db/schema';
import { getAccessibleWorkspacesWithSharedUsers, getWorkspaceSharedUsers } from './db/utils';
import { docker, getDockerContainersList } from './docker';

export const getWorkspaces = (userUuid: Uuid, octokit: Octokit) =>
	getAccessibleWorkspacesWithSharedUsers(userUuid).andThen((workspaces) =>
		getDockerContainersList().map((containersList) =>
			getOkResultAsyncs(
				workspaces.map((workspace) => getWorkspaceContainerInfo(workspace, containersList, octokit))
			)
		)
	);

function getWorkspaceContainerInfo(
	workspaceDBEntry: WorkspaceDBEntry,
	containersInfo: ContainerInfo[],
	octokit: Octokit
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

	let url: string | undefined;

	const bridge = containerInfo.NetworkSettings.Networks['bridge'];

	if (state === 'running' && bridge && bridge.IPAddress !== '')
		url = `http://${bridge.IPAddress}:3000/?folder=${folder}`;

	const sharedUsersInfoPromise = getGitHubUserNameInfos(workspaceDBEntry.sharedUserUuids, octokit);

	const ownerInfoPromise = getGitHubUserInfo(workspaceDBEntry.ownerUuid, octokit).unwrapOr(
		undefined
	);

	const gibi = 1024 ** 3;

	const usageLimits = wrapDockerode(docker.getContainer(workspaceDBEntry.dockerId).inspect())
		.map((info) => ({
			cpusLimit: info.HostConfig.NanoCpus ? info.HostConfig.NanoCpus * 1e-9 : undefined,
			memoryLimitGiB: info.HostConfig.Memory ? info.HostConfig.Memory / gibi : undefined
		}))
		.unwrapOr(undefined);

	return ResultAsync.fromSafePromise(
		(async (): Promise<WorkspaceContainerInfo> => ({
			...workspaceDBEntry,
			state,
			url,
			sharedUsersInfo: await sharedUsersInfoPromise,
			ownerInfo: await ownerInfoPromise,
			cpusLimit: (await usageLimits)?.cpusLimit,
			memoryLimitGiB: (await usageLimits)?.memoryLimitGiB
		}))()
	);
}

const getGitHubUserNameInfos = async (userUuids: Uuid[], octokit: Octokit) =>
	new Map(
		(
			await Promise.all(
				userUuids
					.map(
						(userUuid) =>
							[userUuid, getGitHubUserInfo(userUuid, octokit).unwrapOr(undefined)] as const
					)
					.map(async ([id, promise]) => {
						const userInfo = await promise;
						return userInfo ? ([id, userInfo] as const) : undefined;
					})
			)
		).filter((entry): entry is readonly [Uuid, GitHubUserInfo] => entry !== undefined)
	);

export async function validateWorkspaceAccess(
	userUuid: Uuid,
	workspaceUuid: Uuid
): Promise<Result<{ ownerUuid: Uuid; sharedUserUuids: Uuid[]; dockerId: string }, Response>> {
	const workspaceSelectResult = await wrapDB(
		db
			.select({
				ownerUuid: workspaces.ownerUuid,
				dockerId: workspaces.dockerId
			})
			.from(workspaces)
			.where(eq(workspaces.uuid, workspaceUuid))
	);

	const sharedUserUuidsResult = await getWorkspaceSharedUsers(workspaceUuid);

	if (workspaceSelectResult.isErr() || sharedUserUuidsResult.isErr())
		return err(new Response('Database Error', { status: 500 }));

	const workspaceSelect = workspaceSelectResult.value;
	const sharedUserUuids = sharedUserUuidsResult.value;

	if (workspaceSelect[0] === undefined)
		return err(new Response('Workspace not found', { status: 404 }));

	const workspace = workspaceSelect[0];

	if (workspace.ownerUuid !== userUuid && !sharedUserUuids.includes(userUuid))
		return err(new Response('Forbidden', { status: 403 }));

	return ok({ ...workspace, sharedUserUuids });
}
