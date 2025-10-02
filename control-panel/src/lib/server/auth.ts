import { building } from '$app/environment';
import { tagged } from '$lib/error';
import { useDB } from '$lib/server/db';
import { sessions, users, type Session } from '$lib/server/db/schema';
import { baseDomain, githubOAuthClientId, githubOAuthClientSecret } from '$lib/server/env';
import type { Uuid } from '$lib/types';
import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase64url, encodeHexLowerCase } from '@oslojs/encoding';
import type { RequestEvent } from '@sveltejs/kit';
import { GitHub } from 'arctic';
import { eq } from 'drizzle-orm';
import { err, ok, safeTry } from 'neverthrow';

const DAY_IN_MS = 1000 * 60 * 60 * 24;

export const sessionCookieName = 'auth-session';

export const generateSessionToken = () =>
	encodeBase64url(crypto.getRandomValues(new Uint8Array(18)));

export async function createSession(token: string, userUuid: Uuid) {
	const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));

	const session: Session = {
		id: sessionId,
		userUuid,
		expiresAt: new Date(Date.now() + DAY_IN_MS * 30)
	};

	await useDB((db) => db.insert(sessions).values(session));
	return session;
}

export async function validateSessionToken(token: string) {
	const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));

	const selectResult = await useDB((db) =>
		db
			.select({
				user: {
					uuid: users.uuid,
					name: users.name,
					ghId: users.ghId,
					ghLogin: users.ghLogin,
					ghAccessToken: users.ghAccessToken
				},
				session: sessions
			})
			.from(sessions)
			.innerJoin(users, eq(sessions.userUuid, users.uuid))
			.where(eq(sessions.id, sessionId))
	);
	if (selectResult.isErr()) return { session: null, user: null };

	const [result] = selectResult.value;
	if (!result) return { session: null, user: null };

	const { session, user } = result;
	const sessionExpired = Date.now() >= session.expiresAt.getTime();

	if (sessionExpired) {
		await useDB((db) => db.delete(sessions).where(eq(sessions.id, session.id)));
		return { session: null, user: null };
	}

	const renewSession = Date.now() >= session.expiresAt.getTime() - DAY_IN_MS * 15;

	if (renewSession) {
		session.expiresAt = new Date(Date.now() + DAY_IN_MS * 30);
		await useDB((db) =>
			db.update(sessions).set({ expiresAt: session.expiresAt }).where(eq(sessions.id, session.id))
		);
	}

	return { session, user };
}

export type SessionValidationResult = Awaited<ReturnType<typeof validateSessionToken>>;

export const invalidateSession = (sessionId: string) =>
	useDB((db) => db.delete(sessions).where(eq(sessions.id, sessionId)));

export const setSessionTokenCookie = (event: RequestEvent, token: string, expiresAt: Date) =>
	event.cookies.set(sessionCookieName, token, {
		expires: expiresAt,
		path: '/',
		domain: `.${baseDomain ?? 'codeharbor.localhost'}`
	});

export const deleteSessionTokenCookie = (event: RequestEvent) =>
	event.cookies.delete(sessionCookieName, { path: '/' });

export const githubResult = safeTry(function* () {
	if (building) return err(tagged('GitHubOAuthUnavailableError'));

	if (githubOAuthClientId === undefined) return err(tagged('GitHubOAuthClientIdNotSet'));
	if (githubOAuthClientSecret === undefined) return err(tagged('GitHubOAuthClientSecretNotSet'));

	const github = new GitHub(githubOAuthClientId, githubOAuthClientSecret, null);

	return ok(github);
}).orTee(console.error);
