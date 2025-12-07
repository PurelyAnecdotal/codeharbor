import * as auth from '$lib/server/auth';
import { autostopIntervalMs, autostopThresholdMs } from '$lib/server/config';
import { dbResult, wrapDB } from '$lib/server/db';
import { workspaces } from '$lib/server/db/schema';
import { containerStop, listContainers } from '$lib/server/docker';
import type { Handle, ServerInit } from '@sveltejs/kit';
import { ok, safeTry } from 'neverthrow';

const handleAuth: Handle = async ({ event, resolve }) => {
	const sessionToken = event.cookies.get(auth.sessionCookieName);

	if (sessionToken === undefined) {
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	const { session, user } = await auth.validateSessionToken(sessionToken);

	if (session) {
		auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);
	} else {
		auth.deleteSessionTokenCookie(event);
	}

	event.locals.user = user;
	event.locals.session = session;
	return resolve(event);
};

export const handle: Handle = handleAuth;

export const init: ServerInit = () => {
	setInterval(() => void autostop, autostopIntervalMs);
};

const autostop = () =>
	safeTry(async function* () {
		const db = yield* dbResult;

		const workspacesData = yield* wrapDB(
			db
				.select({
					uuid: workspaces.uuid,
					containerId: workspaces.dockerId,
					lastAccessedAt: workspaces.lastAccessedAt
				})
				.from(workspaces)
		);

		const containerIdToWorkspaceData = new Map(
			workspacesData.map(({ containerId, uuid, lastAccessedAt }) => [
				containerId,
				{ uuid, lastAccessedAt }
			])
		);

		const workspaceContainerIds = workspacesData.map((w) => w.containerId);

		const now = Date.now();

		await Promise.allSettled(
			(yield* listContainers())
				.filter((c) => workspaceContainerIds.includes(c.Id) && c.State === 'running')
				.flatMap(({ Id: containerId }) => {
					const workspaceData = containerIdToWorkspaceData.get(containerId);
					return workspaceData ? [{ containerId, ...workspaceData }] : [];
				})
				.filter(({ lastAccessedAt }) => now - lastAccessedAt.getTime() > autostopThresholdMs)
				.map(({ containerId, uuid }) => {
					console.log(
						`Autostopping container ${containerId} for workspace ${uuid} due to inactivity`
					);
					return containerStop(containerId).orTee((err) => {
						console.error(
							`Failed to autostop container ${containerId} for workspace ${uuid}:`,
							err
						);
					});
				})
		);

		return ok();
	}).orTee(console.error);
