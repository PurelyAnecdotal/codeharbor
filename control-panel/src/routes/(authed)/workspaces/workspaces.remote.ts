import { command, getRequestEvent, query } from '$app/server';
import { tagged, wrapOctokit } from '$lib/error';
import { dbResult, wrapDB } from '$lib/server/db';
import { users, workspaces } from '$lib/server/db/schema';
import {
	calculateContainerResourceUsage,
	containerRemove,
	containerStart,
	containerStats,
	containerStop
} from '$lib/server/docker';
import { initOctokit } from '$lib/server/octokit';
import {
	addWorkspaceSharedUser,
	createWorkspace as createWorkspaceInternal,
	getWorkspacesForWorkspaceList,
	removeWorkspaceSharedUser,
	validateWorkspaceAccessSafeTry,
	WorkspaceCreateOptions
} from '$lib/server/workspaces';
import { zUuid } from '$lib/types';
import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { err, ok, safeTry } from 'neverthrow';
import z from 'zod';

export const getWorkspaces = query(() =>
	safeTry(async function* () {
		const { user } = getRequestEvent().locals;
		if (!user) redirect(307, '/');

		const workspacesList = yield* getWorkspacesForWorkspaceList(user.uuid);

		const sortedWorkspaces = workspacesList.toSorted((a, b) => (b.state === 'running' ? 1 : -1));

		return ok(sortedWorkspaces);
	}).orTee(console.error)
);

export const getWorkspaceStats = query(zUuid(), (workspaceUuid) =>
	safeTry(async function* () {
		const { user } = getRequestEvent().locals;
		if (!user) redirect(307, '/');

		const { dockerId } = yield* validateWorkspaceAccessSafeTry(user.uuid, workspaceUuid);

		const dockerContainerStats = yield* containerStats(dockerId);

		return ok(calculateContainerResourceUsage(dockerContainerStats));
	}).orTee(console.error)
);

export const startWorkspace = command(zUuid(), (workspaceUuid) =>
	safeTry(async function* () {
		const { user } = getRequestEvent().locals;
		if (!user) return err(tagged('UnauthorizedError'));

		const db = yield* dbResult;

		const { dockerId } = yield* validateWorkspaceAccessSafeTry(user.uuid, workspaceUuid);

		yield* containerStart(dockerId);
		db.update(workspaces)
			.set({ lastAccessedAt: new Date() })
			.where(eq(workspaces.uuid, workspaceUuid));

		return ok();
	}).orTee(console.error)
);

export const stopWorkspace = command(zUuid(), (workspaceUuid) =>
	safeTry(async function* () {
		const { user } = getRequestEvent().locals;
		if (!user) return err(tagged('UnauthorizedError'));

		const { dockerId } = yield* validateWorkspaceAccessSafeTry(user.uuid, workspaceUuid);

		yield* containerStop(dockerId);

		return ok();
	}).orTee(console.error)
);

export const deleteWorkspace = command(zUuid(), (workspaceUuid) =>
	safeTry(async function* () {
		const { user } = getRequestEvent().locals;
		if (!user) return err(tagged('UnauthorizedError'));

		const { dockerId } = yield* validateWorkspaceAccessSafeTry(user.uuid, workspaceUuid);

		yield* containerRemove(dockerId);

		return ok();
	}).orTee(console.error)
);

export const shareWorkspace = command(
	z.object({
		workspaceUuid: zUuid(),
		userUuidToShare: zUuid()
	}),
	({ workspaceUuid, userUuidToShare }) =>
		safeTry(async function* () {
			const { user } = getRequestEvent().locals;
			if (!user) return err(tagged('UnauthorizedError'));

			const { ownerUuid, sharedUserUuids } = yield* validateWorkspaceAccessSafeTry(
				user.uuid,
				workspaceUuid
			);

			if (ownerUuid === userUuidToShare || sharedUserUuids.includes(userUuidToShare)) return ok();

			yield* addWorkspaceSharedUser(workspaceUuid, userUuidToShare);

			return ok();
		}).orTee(console.error)
);

export const unshareWorkspace = command(
	z.object({
		workspaceUuid: zUuid(),
		userUuidToUnshare: zUuid()
	}),
	({ workspaceUuid, userUuidToUnshare }) =>
		safeTry(async function* () {
			const { user } = getRequestEvent().locals;
			if (!user) return err(tagged('UnauthorizedError'));

			const { ownerUuid, sharedUserUuids } = yield* validateWorkspaceAccessSafeTry(
				user.uuid,
				workspaceUuid
			);

			if (ownerUuid === userUuidToUnshare || !sharedUserUuids.includes(userUuidToUnshare))
				return ok();

			yield* removeWorkspaceSharedUser(workspaceUuid, userUuidToUnshare);

			return ok();
		}).orTee(console.error)
);

export const createWorkspace = command(WorkspaceCreateOptions, ({ name, source }) =>
	safeTry(async function* () {
		const { user } = getRequestEvent().locals;
		if (!user) return err(tagged('UnauthorizedError'));

		const octokit = yield* initOctokit(user.ghAccessToken);

		yield* await createWorkspaceInternal({ name, source }, user.uuid, octokit);

		return ok();
	})
);

export const getUserUuidFromGithub = command(z.string(), (ghUsername) =>
	safeTry(async function* () {
		const { user } = getRequestEvent().locals;
		if (!user) return err(tagged('UnauthorizedError'));

		const db = yield* dbResult;

		const octokit = yield* initOctokit(user.ghAccessToken);
		const {
			data: { id: ghId }
		} = yield* wrapOctokit(
			octokit.users.getByUsername({
				username: ghUsername
			})
		);

		const retrievedUser = yield* wrapDB(
			db.select({ uuid: users.uuid }).from(users).where(eq(users.ghId, ghId)).limit(1)
		).map((r) => r[0]);

		if (!retrievedUser) return err(tagged('GitHubUserNotCreated'));

		return ok(retrievedUser.uuid);
	})
);
