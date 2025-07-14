import {
	AUTH_GITHUB_ID as GITHUB_CLIENT_ID,
	AUTH_GTIHUB_SECRET as GITHUB_CLIENT_SECRET
} from '$env/static/private';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import type { Uuid } from '$lib/types';
import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase64url, encodeHexLowerCase } from '@oslojs/encoding';
import type { RequestEvent } from '@sveltejs/kit';
import { GitHub } from 'arctic';
import { eq } from 'drizzle-orm';

const DAY_IN_MS = 1000 * 60 * 60 * 24;

export const sessionCookieName = 'auth-session';

export const generateSessionToken = () =>
	encodeBase64url(crypto.getRandomValues(new Uint8Array(18)));

export async function createSession(token: string, userUuid: Uuid) {
	const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));

	const session: table.Session = {
		id: sessionId,
		userUuid,
		expiresAt: new Date(Date.now() + DAY_IN_MS * 30)
	};

	await db.insert(table.session).values(session);
	return session;
}

export async function validateSessionToken(token: string) {
	const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));

	const [result] = await db
		.select({
			user: {
				uuid: table.user.uuid,
				ghId: table.user.ghId,
				ghLogin: table.user.ghLogin,
				ghName: table.user.ghName,
				ghAccessToken: table.user.ghAccessToken
			},
			session: table.session
		})
		.from(table.session)
		.innerJoin(table.user, eq(table.session.userUuid, table.user.uuid))
		.where(eq(table.session.id, sessionId));

	if (!result) return { session: null, user: null };

	const { session, user } = result;
	const sessionExpired = Date.now() >= session.expiresAt.getTime();

	if (sessionExpired) {
		await db.delete(table.session).where(eq(table.session.id, session.id));
		return { session: null, user: null };
	}

	const renewSession = Date.now() >= session.expiresAt.getTime() - DAY_IN_MS * 15;

	if (renewSession) {
		session.expiresAt = new Date(Date.now() + DAY_IN_MS * 30);
		await db
			.update(table.session)
			.set({ expiresAt: session.expiresAt })
			.where(eq(table.session.id, session.id));
	}

	return { session, user };
}

export type SessionValidationResult = Awaited<ReturnType<typeof validateSessionToken>>;

export const invalidateSession = (sessionId: string) =>
	db
		.delete(table.session)
		.where(eq(table.session.id, sessionId))
		.then(() => {});

export const setSessionTokenCookie = (event: RequestEvent, token: string, expiresAt: Date) =>
	event.cookies.set(sessionCookieName, token, { expires: expiresAt, path: '/' });

export const deleteSessionTokenCookie = (event: RequestEvent) =>
	event.cookies.delete(sessionCookieName, { path: '/' });

export const github = new GitHub(GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, null);
