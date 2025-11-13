import * as auth from '$lib/server/auth';
import { autostopIntervalMs, autostopThresholdMs } from '$lib/server/config';
import { dbResult, wrapDB } from '$lib/server/db';
import { workspaces } from '$lib/server/db/schema';
import { containerStop, listContainers } from '$lib/server/docker';
import type { ContainerState } from '$lib/types';
import type { Handle, ServerInit } from '@sveltejs/kit';
import { ok, safeTry } from 'neverthrow';

const handleAuth: Handle = async ({ event, resolve }) => {
	const sessionToken = event.cookies.get(auth.sessionCookieName);

	if (!sessionToken) {
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

export const init: ServerInit = async () => {
	setInterval(autostop, autostopIntervalMs);
};

const autostop = () =>
	safeTry(async function* () {
		const db = yield* dbResult;

		const workspacesData = (yield* wrapDB(
			db
				.select({
					dockerId: workspaces.dockerId,
					lastAccessedAt: workspaces.lastAccessedAt
				})
				.from(workspaces)
		));

		const lastAccessMap = new Map(workspacesData.map((w) => [w.dockerId, w.lastAccessedAt]));

		const workspaceIds = workspacesData.map((w) => w.dockerId);

		(yield* listContainers())
			.filter((c) => workspaceIds.includes(c.Id) && (c.State as ContainerState) === 'running')
			.forEach((container) => {
				const lastAccessedAt = lastAccessMap.get(container.Id);
				if (!lastAccessedAt) return;

				if (Date.now() - lastAccessedAt.getTime() > autostopThresholdMs) {
					console.log(`Autostopping workspace container ${container.Id} due to inactivity`);

					containerStop(container.Id).orTee(console.error);
				}
			});

		return ok();
	}).orTee(console.error);
