import { sha256 } from '@oslojs/crypto/sha2';
import { encodeHexLowerCase } from '@oslojs/encoding';
import { eq } from 'drizzle-orm';
import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { db } from './db';
import * as schema from './schema';

const sessionCookieName = 'auth-session';

const DAY_IN_MS = 1000 * 60 * 60 * 24;

export async function validateSessionToken(token: string) {
	const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));

	const [result] = await db
		.select({
			user: {
				uuid: schema.users.uuid
			},
			session: schema.sessions
		})
		.from(schema.sessions)
		.innerJoin(schema.users, eq(schema.sessions.userUuid, schema.users.uuid))
		.where(eq(schema.sessions.id, sessionId));

	if (!result) return { session: null, user: null };

	const { session, user } = result;
	const sessionExpired = Date.now() >= session.expiresAt.getTime();

	if (sessionExpired) {
		await db.delete(schema.sessions).where(eq(schema.sessions.id, session.id));
		return { session: null, user: null };
	}

	const renewSession = Date.now() >= session.expiresAt.getTime() - DAY_IN_MS * 15;

	if (renewSession) {
		session.expiresAt = new Date(Date.now() + DAY_IN_MS * 30);
		await db
			.update(schema.sessions)
			.set({ expiresAt: session.expiresAt })
			.where(eq(schema.sessions.id, session.id));
	}

	return { session, user };
}

export const authMiddleware = createMiddleware(async (c, next) => {
	const sessionToken = getCookie(c, sessionCookieName);
	if (sessionToken !== undefined) {
		const { user } = await validateSessionToken(sessionToken);
		if (user) c.set('userUuid', user.uuid);
	}
	await next();
});
