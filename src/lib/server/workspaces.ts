import { OPENVSCODE_SERVER_MOUNT_PATH } from '$env/static/private';
import { tagged, wrapDB, wrapOctokit, type Tagged } from '$lib/error';
import type { InferAsyncOk } from '$lib/result';
import { db } from '$lib/server/db';
import { templates, workspaces, workspacesToSharedUsers } from '$lib/server/db/schema';
import { jsonGroupArray } from '$lib/server/db/utils';
import {
	containerCreate,
	containerInspect,
	containerRemove,
	containerStart,
	containerWait,
	getContainerResourceLimits,
	listContainers
} from '$lib/server/docker';
import { getGitHubUserInfo } from '$lib/server/octokit';
import { getGhRepoNameFromTemplate } from '$lib/server/templates';
import { githubRepoRegex, type ContainerState, type GitHubUserInfo, type Uuid } from '$lib/types';
import type { Octokit } from '@octokit/rest';
import { eq, getTableColumns, inArray, sql } from 'drizzle-orm';
import { union } from 'drizzle-orm/sqlite-core';
import { Result, ResultAsync, err, ok, okAsync, safeTry } from 'neverthrow';
import z from 'zod';

export const getWorkspacesForWorkspaceList = (userUuid: Uuid, octokit: Octokit) =>
	safeTry(async function* () {
		const workspaceUuids = yield* getAccessibleWorkspaceUuids(userUuid);

		const workspacesData = yield* wrapDB(
			db
				.select({
					...getTableColumns(workspaces),
					sharedUserUuids: jsonGroupArray(workspacesToSharedUsers.userUuid),
					template: {
						name: templates.name,
						ghRepoName: templates.ghRepoName,
						ghRepoOwner: templates.ghRepoOwner
					}
				})
				.from(workspaces)
				.where(inArray(workspaces.uuid, workspaceUuids))
				.leftJoin(
					workspacesToSharedUsers,
					eq(workspaces.uuid, workspacesToSharedUsers.workspaceUuid)
				)
				.leftJoin(templates, eq(workspaces.templateUuid, templates.uuid))
				.groupBy(workspaces.uuid)
		);

		const containersList = yield* listContainers();

		const workspaceContainerInfos = await Promise.all(
			workspacesData
				.flatMap((workspace) => {
					const containerInfo = containersList.find((c) => c.Id === workspace.dockerId);

					if (containerInfo) return [[workspace, containerInfo]] as const;

					console.warn(
						`Container ${workspace.dockerId} not found; removing workspace ${workspace.uuid} from database.`
					);

					wrapDB(db.delete(workspaces).where(eq(workspaces.uuid, workspace.uuid))).orTee((err) =>
						console.error('Failed to remove workspace ${uuid} from database: ', err)
					);

					return [];
				})
				.map(async ([workspace, containerInfo]) => {
					const state = containerInfo.State as ContainerState;

					let url: string | undefined;

					const bridge = containerInfo.NetworkSettings.Networks['bridge'];

					if (state === 'running' && bridge && bridge.IPAddress !== '')
						url = `http://${bridge.IPAddress}:3000/?folder=${workspace.folder}`;

					const usageLimitsPromise = getContainerResourceLimits(workspace.dockerId).unwrapOr(
						undefined
					);

					return {
						...workspace,
						state,
						url,
						sharedUsersInfo: await getGitHubUserNameInfos(workspace.sharedUserUuids, octokit),
						ownerInfo: await getGitHubUserInfo(workspace.ownerUuid, octokit).unwrapOr(undefined),
						cpusLimit: (await usageLimitsPromise)?.cpusLimit,
						memoryLimitGiB: (await usageLimitsPromise)?.memoryLimitGiB
					};
				})
		);

		return ok(workspaceContainerInfos);
	});

export type WorkspaceContainerInfo = InferAsyncOk<ReturnType<typeof getWorkspacesForWorkspaceList>>[0];

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

export const WorkspaceCreateOptions = z.object({
	name: z.string(),
	source: z.discriminatedUnion('type', [
		z.object({
			type: z.literal('template'),
			templateUuid: z.uuidv4().transform((val) => val as Uuid)
		}),
		z.object({
			type: z.literal('github'),
			ghRepoOwner: z.string().regex(githubRepoRegex),
			ghRepoName: z.string().regex(githubRepoRegex)
		})
	])
});

export type WorkspaceCreateOptions = z.infer<typeof WorkspaceCreateOptions>;

export const createWorkspace = (
	{ name, source }: WorkspaceCreateOptions,
	ownerUuid: Uuid,
	octokit: Octokit,
	ghAccessToken: string
) =>
	safeTry(async function* () {
		const { ghRepoOwner, ghRepoName } = yield* await getGhRepoNameFromWorkspaceSource(source);

		const repoValidate = yield* await wrapOctokit(
			octokit.rest.repos.get({ owner: ghRepoOwner, repo: ghRepoName })
		);

		const cloneUrlObject = new URL(repoValidate.data.clone_url);
		cloneUrlObject.username = ghAccessToken;
		const authenticatedCloneURL = cloneUrlObject.toString();

		// Create git clone container

		console.log(`Creating git clone container for ${ghRepoOwner}/${ghRepoName}...`);

		const workspaceUuid = crypto.randomUUID();

		const gitContainer = yield* await createGitCloneContainer(workspaceUuid, authenticatedCloneURL);

		// Start git clone container

		yield* await containerStart(gitContainer.id);

		// Wait for git clone container to finish

		yield* await containerWait(gitContainer.id);

		// Inspect git clone container to check if it completed successfully

		const gitContainerInspectInfo = yield* await containerInspect(gitContainer.id);

		if (gitContainerInspectInfo.State?.ExitCode !== 0)
			return err(tagged('GitCloneError', gitContainerInspectInfo.State.Error));

		// Remove git clone container

		containerRemove(gitContainer.id).orTee((err) =>
			console.error('Failed to remove git container:', err)
		);

		// Create workspace container

		console.log(`Creating workspace container for ${ghRepoOwner}/${ghRepoName}...`);

		const workspaceVolumeMountDir = `/config/workspace/${ghRepoName}`;

		const workspaceContainer = yield* await createWorkspaceContainer(
			workspaceUuid,
			workspaceVolumeMountDir
		);

		// Insert workspace into database

		yield* await wrapDB(
			db.insert(workspaces).values({
				uuid: workspaceUuid,
				name,
				ownerUuid,
				dockerId: workspaceContainer.id,
				templateUuid: source.type === 'template' ? source.templateUuid : null,
				folder: workspaceVolumeMountDir
			})
		);

		await containerStart(workspaceContainer.id).orTee((err) =>
			console.error('Failed to start workspace container:', err)
		);

		return ok();
	});

function getGhRepoNameFromWorkspaceSource(
	source: WorkspaceCreateOptions['source']
): ResultAsync<
	{ ghRepoOwner: string; ghRepoName: string },
	Tagged<'TemplateNotFoundError' | 'DBError'>
> {
	if (source.type === 'github')
		return okAsync({
			ghRepoOwner: source.ghRepoOwner,
			ghRepoName: source.ghRepoName
		});

	return getGhRepoNameFromTemplate(source.templateUuid);
}

const gitImage = 'cgr.dev/chainguard/git';

const createGitCloneContainer = (workspaceUuid: Uuid, cloneUrl: string) =>
	containerCreate({
		Image: gitImage,
		name: `annex-git-clone-${workspaceUuid}`,
		HostConfig: {
			Mounts: [
				{
					Type: 'volume',
					Source: `annex-${workspaceUuid}`,
					Target: '/home/git'
				}
			]
		},
		Entrypoint: ['/bin/sh', '-c', `exec /usr/bin/git clone ${cloneUrl} /home/git`, '--']
	});

const gibi = 1024 ** 3;

const createWorkspaceContainer = (workspaceUuid: Uuid, workspaceVolumeMountDir: string) =>
	containerCreate({
		Image: 'mcr.microsoft.com/devcontainers/base',
		name: `annex-code-server-${workspaceUuid}`,
		// Env: ['CODE_ARGS=--server-base-path /instance'],
		HostConfig: {
			Mounts: [
				{
					Type: 'volume',
					Source: `annex-${workspaceUuid}`,
					Target: workspaceVolumeMountDir
				},
				{
					Type: 'bind',
					Source: OPENVSCODE_SERVER_MOUNT_PATH,
					Target: '/openvscode-server',
					ReadOnly: true
				}
			],
			NanoCpus: 1 * 1e9,
			Memory: 1 * gibi
		},
		Entrypoint: [
			'/bin/sh',
			'-c',
			'exec /openvscode-server/bin/openvscode-server --host 0.0.0.0 --without-connection-token',
			'--'
		]
		// User: 'vscode'
	});

const getWorkspaceSharedUsers = (workspaceUuid: Uuid) =>
	wrapDB(
		db
			.select({
				sharedUserUuids: sql<Uuid[]>`json_group_array(${workspacesToSharedUsers.userUuid})`
			})
			.from(workspacesToSharedUsers)
			.where(eq(workspacesToSharedUsers.workspaceUuid, workspaceUuid))
			.groupBy(workspacesToSharedUsers.workspaceUuid)
	).map((v) => v[0]?.sharedUserUuids ?? []);

const getAccessibleWorkspaceUuids = (userUuid: Uuid) =>
	wrapDB(
		union(
			db
				.select({ uuid: workspaces.uuid })
				.from(workspaces)
				.where(eq(workspaces.ownerUuid, userUuid)),
			db
				.select({ uuid: workspaces.uuid })
				.from(workspaces)
				.innerJoin(
					workspacesToSharedUsers,
					eq(workspaces.uuid, workspacesToSharedUsers.workspaceUuid)
				)
				.where(eq(workspacesToSharedUsers.userUuid, userUuid))
		)
	).map((workspaces) => workspaces.map((x) => x.uuid));
