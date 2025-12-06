import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { frontendServer, sessionCookieName } from './env.js';

export const authMiddleware = createMiddleware(async (c, next) => {
	const sessionToken = getCookie(c, sessionCookieName);

	if (sessionToken !== undefined) {
		try {
			const res = await fetch(`http://${frontendServer}/api/user/getuuid`, {
				headers: { cookie: `${sessionCookieName}=${sessionToken}` }
			});
			const text = await res.text();
			if (res.status !== 200) {
				console.error('Error validating session token:', res.status, text);
			} else {
				c.set('userUuid', text);
			}
		} catch (err) {
			console.error('Error validating session token:', err);
		}
	}

	await next();
});
