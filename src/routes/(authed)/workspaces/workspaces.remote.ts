import { command, getRequestEvent, query } from '$app/server';
import { hideCause } from '$lib/error';
import { RAtoJ } from '$lib/result';
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
import { ok, safeTry } from 'neverthrow';
import z from 'zod';

export const getWorkspaces = query(() =>
	safeTry(async function* () {
		const { user } = getRequestEvent().locals;
		if (!user) redirect(307, '/');

		const workspacesList = yield* getWorkspacesForWorkspaceList(user.uuid);

		return ok(workspacesList);
	})
);

export const getWorkspaceStats = query(zUuid(), (workspaceUuid) =>
	safeTry(async function* () {
		const { user } = getRequestEvent().locals;
		if (!user) redirect(307, '/');

		const { dockerId } = yield* validateWorkspaceAccessSafeTry(user.uuid, workspaceUuid);

		const dockerContainerStats = yield* containerStats(dockerId);

		return ok(calculateContainerResourceUsage(dockerContainerStats));
	})
);

export const startWorkspace = command(zUuid(), (workspaceUuid) =>
	RAtoJ(
		safeTry(async function* () {
			const { user } = getRequestEvent().locals;
			if (!user) redirect(307, '/');

			const { dockerId } = yield* validateWorkspaceAccessSafeTry(user.uuid, workspaceUuid);

			yield* containerStart(dockerId);

			return ok();
		})
	)
);

export const stopWorkspace = command(zUuid(), (workspaceUuid) =>
	RAtoJ(
		safeTry(async function* () {
			const { user } = getRequestEvent().locals;
			if (!user) redirect(307, '/');

			const { dockerId } = yield* validateWorkspaceAccessSafeTry(user.uuid, workspaceUuid);

			yield* containerStop(dockerId);

			return ok();
		})
	)
);

export const deleteWorkspace = command(zUuid(), (workspaceUuid) =>
	RAtoJ(
		safeTry(async function* () {
			const { user } = getRequestEvent().locals;
			if (!user) redirect(307, '/');

			const { dockerId } = yield* validateWorkspaceAccessSafeTry(user.uuid, workspaceUuid);

			yield* containerRemove(dockerId);

			return ok();
		}).mapErr(hideCause)
	)
);

export const shareWorkspace = command(
	z.object({
		workspaceUuid: zUuid(),
		userUuidToShare: zUuid()
	}),
	({ workspaceUuid, userUuidToShare }) =>
		RAtoJ(
			safeTry(async function* () {
				const { user } = getRequestEvent().locals;
				if (!user) redirect(307, '/');

				const { ownerUuid, sharedUserUuids } = yield* validateWorkspaceAccessSafeTry(
					user.uuid,
					workspaceUuid
				);

				if (ownerUuid === userUuidToShare || sharedUserUuids.includes(userUuidToShare)) return ok();

				yield* addWorkspaceSharedUser(workspaceUuid, userUuidToShare);

				return ok();
			})
		)
);

export const unshareWorkspace = command(
	z.object({
		workspaceUuid: zUuid(),
		userUuidToUnshare: zUuid()
	}),
	({ workspaceUuid, userUuidToUnshare }) =>
		RAtoJ(
			safeTry(async function* () {
				const { user } = getRequestEvent().locals;
				if (!user) redirect(307, '/');

				const { ownerUuid, sharedUserUuids } = yield* validateWorkspaceAccessSafeTry(
					user.uuid,
					workspaceUuid
				);

				if (ownerUuid === userUuidToUnshare || sharedUserUuids.includes(userUuidToUnshare))
					return ok();

				yield* removeWorkspaceSharedUser(workspaceUuid, userUuidToUnshare);

				return ok();
			})
		)
);
