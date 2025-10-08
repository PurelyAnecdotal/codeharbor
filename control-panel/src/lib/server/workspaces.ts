import { tagged, wrapOctokit } from '$lib/error';
import { JSONSafeParse, type InferAsyncOk } from '$lib/result';
import { dbResult, useDB, wrapDB } from '$lib/server/db';
import { templates, users, workspaces, workspacesToSharedUsers } from '$lib/server/db/schema';
import { jsonGroupArray } from '$lib/server/db/utils';
import {
	containerCreate,
	containerInspect,
	containerRemove,
	containerStart,
	containerWait,
	getContainerResourceLimits,
	imageInspect,
	listContainers
} from '$lib/server/docker';
import { dockerNetworkName, openvscodeServerMountPath } from '$lib/server/env';
import { githubRepoRegex, zUuid, type ContainerState, type Uuid } from '$lib/types';
import type { Octokit } from '@octokit/rest';
import { and, eq, getTableColumns, inArray } from 'drizzle-orm';
import { union } from 'drizzle-orm/sqlite-core';
import { err, ok, Result, safeTry } from 'neverthrow';
import z from 'zod';

const gitImage = 'cgr.dev/chainguard/git';

const gibi = 1024 ** 3;

export const getWorkspacesForWorkspaceList = (userUuid: Uuid) =>
	safeTry(async function* () {
		const db = yield* dbResult;

		const workspaceUuids = yield* getAccessibleWorkspaceUuids(userUuid);

		const workspacesData = yield* wrapDB(
			db
				.select({
					...getTableColumns(workspaces),
					sharedUserUuids: jsonGroupArray(workspacesToSharedUsers.userUuid),
					template: {
						uuid: templates.uuid,
						name: templates.name,
						ghRepoName: templates.ghRepoName,
						ghRepoOwner: templates.ghRepoOwner
					},
					owner: {
						uuid: users.uuid,
						name: users.name,
						ghId: users.ghId,
						ghLogin: users.ghLogin
					}
				})
				.from(workspaces)
				.where(inArray(workspaces.uuid, workspaceUuids))
				.leftJoin(
					workspacesToSharedUsers,
					eq(workspaces.uuid, workspacesToSharedUsers.workspaceUuid)
				)
				.leftJoin(templates, eq(workspaces.templateUuid, templates.uuid))
				.innerJoin(users, eq(workspaces.ownerUuid, users.uuid))
				.groupBy(workspaces.uuid)
		);

		const allSharedUserUuids = [
			...new Set(workspacesData.map((workspace) => workspace.sharedUserUuids).flat())
		];

		const sharedUserEntries = yield* wrapDB(
			db
				.select({
					uuid: users.uuid,
					name: users.name,
					ghId: users.ghId,
					ghLogin: users.ghLogin
				})
				.from(users)
				.where(inArray(users.uuid, allSharedUserUuids))
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

					const sharedUsers = sharedUserEntries.filter(({ uuid }) =>
						workspace.sharedUserUuids.includes(uuid)
					);

					const usageLimits = await getContainerResourceLimits(workspace.dockerId).unwrapOr(null);

					const { sharedUserUuids, ownerUuid, ...restWorkspace } = workspace;

					const workspaceContainerInfo = { ...restWorkspace, state, sharedUsers, usageLimits };

					return workspaceContainerInfo;
				})
		);

		return ok(workspaceContainerInfos);
	});

export type WorkspaceContainerInfo = InferAsyncOk<
	ReturnType<typeof getWorkspacesForWorkspaceList>
>[0];

export async function validateWorkspaceAccess(
	userUuid: Uuid,
	workspaceUuid: Uuid
): Promise<Result<{ ownerUuid: Uuid; sharedUserUuids: Uuid[]; dockerId: string }, Response>> {
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
	);

	if (workspaceSelectResult.isErr()) return err(new Response('Database Error', { status: 500 }));

	const workspaceSelect = workspaceSelectResult.value;

	if (workspaceSelect[0] === undefined)
		return err(new Response('Workspace not found', { status: 404 }));

	const workspace = workspaceSelect[0];

	if (workspace.ownerUuid !== userUuid && !workspace.sharedUserUuids.includes(userUuid))
		return err(new Response('Forbidden', { status: 403 }));

	return ok(workspace);
}

export const validateWorkspaceAccessSafeTry = (userUuid: Uuid, workspaceUuid: Uuid) =>
	safeTry(async function* () {
		const db = yield* dbResult;

		const workspaceSelect = yield* wrapDB(
			db
				.select({
					ownerUuid: workspaces.ownerUuid,
					dockerId: workspaces.dockerId,
					sharedUserUuids: jsonGroupArray(workspacesToSharedUsers.userUuid)
				})
				.from(workspaces)
				.where(eq(workspaces.uuid, workspaceUuid))
				.leftJoin(
					workspacesToSharedUsers,
					eq(workspaces.uuid, workspacesToSharedUsers.workspaceUuid)
				)
		);

		if (workspaceSelect[0] === undefined) return err(tagged('WorkspaceNotFoundError'));

		const workspace = workspaceSelect[0];

		if (workspace.ownerUuid !== userUuid && !workspace.sharedUserUuids.includes(userUuid))
			return err(tagged('WorkspaceAccessError'));

		return ok(workspace);
	});

export const WorkspaceCreateOptions = z.object({
	name: z.string(),
	source: z.discriminatedUnion('type', [
		z.object({
			type: z.literal('template'),
			templateUuid: zUuid()
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
	octokit: Octokit
) =>
	safeTry(async function* () {
		const db = yield* dbResult;

		if (openvscodeServerMountPath === undefined)
			return err(tagged('OpenVSCodeServerMountPathNotSet'));

		if (source.type === 'github') return err(tagged('GitHubSourceNotSupportedError'));

		const { templateUuid } = source;

		const [template] = yield* wrapDB(
			db
				.select({
					ghRepoOwner: templates.ghRepoOwner,
					ghRepoName: templates.ghRepoName,
					devcontainerImage: templates.devcontainerImage,
					owner: {
						ghAccessToken: users.ghAccessToken
					}
				})
				.from(templates)
				.where(eq(templates.uuid, templateUuid))
				.innerJoin(users, eq(templates.ownerUuid, users.uuid))
		);
		if (!template) return err(tagged('TemplateNotFoundError'));

		const { ghRepoOwner, ghRepoName, devcontainerImage: devcontainerImageName } = template;

		const workspaceUuid = crypto.randomUUID();
		const volumeName = `codeharbor-${workspaceUuid}`;
		const workspaceVolumeMountDir = `/config/workspace/${ghRepoName}`;

		const repoValidate = yield* await wrapOctokit(
			octokit.rest.repos.get({ owner: ghRepoOwner, repo: ghRepoName })
		);

		const cloneUrlObject = new URL(repoValidate.data.clone_url);
		cloneUrlObject.username = template.owner.ghAccessToken;
		const authenticatedCloneURL = cloneUrlObject.toString();

		yield* cloneGitRepoIntoVolume(authenticatedCloneURL, volumeName);

		let entrypoints: string[] | undefined = undefined;
		let containerUser = 'root';

		if (devcontainerImageName) {
			const image = yield* imageInspect(devcontainerImageName);

			const metadata = image.Config.Labels['devcontainer.metadata'];
			if (metadata === undefined) return err(tagged('ImageDevcontainerMetadataMissingError'));

			const parsedMetadataResult = DevcontainerImageMetadataSubset.safeParse(
				yield* JSONSafeParse(metadata)
			);
			if (!parsedMetadataResult.success)
				return err(tagged('ImageDevcontainerMetadataParseError', parsedMetadataResult.error));

			const parsedMetadata = parsedMetadataResult.data;

			entrypoints = parsedMetadata.flatMap((item) => item.entrypoint ?? []);
			containerUser =
				parsedMetadata.find((item) => item.containerUser !== undefined)?.containerUser ??
				containerUser;

			if (containerUser !== 'root') {
				// TODO: assuming that the containerUser has UID 1000
				const tempContainer = yield* containerCreate({
					Image: 'oven/bun:alpine',
					name: `codeharbor-temp-${workspaceUuid}`,
					HostConfig: {
						Mounts: [
							{
								Type: 'volume',
								Source: `codeharbor-${workspaceUuid}`,
								Target: '/workspace'
							}
						],
						Init: true
					},
					Entrypoint: ['/bin/sh'],
					Cmd: ['-c', `chown -R 1000:1000 /workspace`, '--']
				});
				yield* containerStart(tempContainer.id);
				yield* containerWait(tempContainer.id);
				containerRemove(tempContainer.id).orTee((err) =>
					console.error('Failed to remove temporary container:', err)
				);
			}
		} else {
			// containerUser = 'vscode';
		}

		const entrypointsMerged = entrypoints ? entrypoints.map((e) => e + '\n').join('') : '';

		const workspaceContainer = yield* containerCreate({
			Image: devcontainerImageName ?? 'mcr.microsoft.com/devcontainers/base:ubuntu',
			name: `codeharbor-code-server-${workspaceUuid}`,
			// Env: ['CODE_ARGS=--server-base-path /instance'],
			HostConfig: {
				Mounts: [
					{
						Type: 'volume',
						Source: `codeharbor-${workspaceUuid}`,
						Target: workspaceVolumeMountDir
					},
					{
						Type: 'bind',
						Source: openvscodeServerMountPath,
						Target: '/openvscode-server',
						ReadOnly: true
					}
				],
				NetworkMode: dockerNetworkName ?? 'codeharbor',
				NanoCpus: 1 * 1e9,
				Memory: 1 * gibi,
				Init: true
			},
			Entrypoint: ['/bin/sh'],
			Cmd: [
				'-c',
				`${entrypointsMerged}
				/openvscode-server/bin/openvscode-server --host 0.0.0.0 --without-connection-token`,
				'--'
			],
			User: containerUser
		});

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

export const cloneGitRepoIntoVolume = (cloneUrl: string, volumeName: string) =>
	safeTry(async function* () {
		const gitContainer = yield* containerCreate({
			Image: gitImage,
			name: `codeharbor-git-clone-${volumeName}`,
			HostConfig: {
				Mounts: [
					{
						Type: 'volume',
						Source: volumeName,
						Target: '/home/git'
					}
				]
			},
			Entrypoint: ['/bin/sh', '-c', `exec /usr/bin/git clone ${cloneUrl} /home/git`, '--']
		});

		yield* await containerStart(gitContainer.id);

		yield* await containerWait(gitContainer.id);

		const gitContainerInspectInfo = yield* await containerInspect(gitContainer.id);

		if (gitContainerInspectInfo.State.ExitCode !== 0)
			return err(tagged('GitCloneError', gitContainerInspectInfo.State.Error));

		containerRemove(gitContainer.id).orTee((err) =>
			console.error('Failed to remove git container:', err)
		);

		return ok();
	});

const getAccessibleWorkspaceUuids = (userUuid: Uuid) =>
	useDB((db) =>
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

export const addWorkspaceSharedUser = (workspaceUuid: Uuid, userUuidToAdd: Uuid) =>
	useDB((db) =>
		db.insert(workspacesToSharedUsers).values({ userUuid: userUuidToAdd, workspaceUuid })
	);

export const removeWorkspaceSharedUser = (workspaceUuid: Uuid, userUuidToRemove: Uuid) =>
	useDB((db) =>
		db
			.delete(workspacesToSharedUsers)
			.where(
				and(
					eq(workspacesToSharedUsers.workspaceUuid, workspaceUuid),
					eq(workspacesToSharedUsers.userUuid, userUuidToRemove)
				)
			)
	);

const DevcontainerImageMetadataSubset = z.array(
	z.object({
		id: z.string().optional(),
		entrypoint: z.string().optional(),
		containerUser: z.string().optional(),
		remoteUser: z.string().optional()
	})
);
