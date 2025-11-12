import { command, getRequestEvent, query } from '$app/server';
import { tagged } from '$lib/error';
import {
	calculateContainerResourceUsage,
	containerRemove,
	containerStart,
	containerStats,
	containerStop
} from '$lib/server/docker';
import {
	addWorkspaceSharedUser,
	getWorkspacesForWorkspaceList,
	removeWorkspaceSharedUser,
	validateWorkspaceAccessSafeTry
} from '$lib/server/workspaces';
import { zUuid } from '$lib/types';
import { redirect } from '@sveltejs/kit';
import { err, ok, safeTry } from 'neverthrow';
import z from 'zod';

export const getWorkspaces = query(() =>
	safeTry(async function* () {
		const { user } = getRequestEvent().locals;
		if (!user) redirect(307, '/');

		const workspacesList = yield* getWorkspacesForWorkspaceList(user.uuid);

		const sortedWorkspaces = workspacesList.toSorted((a, b) => (b.state === 'running' ? 1 : 0));

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

		const { dockerId } = yield* validateWorkspaceAccessSafeTry(user.uuid, workspaceUuid);

		yield* containerStart(dockerId);

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

			if (ownerUuid === userUuidToUnshare || sharedUserUuids.includes(userUuidToUnshare))
				return ok();

			yield* removeWorkspaceSharedUser(workspaceUuid, userUuidToUnshare);

			return ok();
		}).orTee(console.error)
);
