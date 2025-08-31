import { deleteSessionTokenCookie, invalidateSession } from '$lib/server/auth';

export async function GET(event) {
	if (!event.locals.session) return new Response('Unauthorized', { status: 401 });

	await invalidateSession(event.locals.session.id);
	deleteSessionTokenCookie(event);

	return new Response(null, {
		status: 302,
		headers: {
			Location: '/'
		}
	});
}
