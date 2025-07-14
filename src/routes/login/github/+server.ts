import { generateState } from 'arctic';
import { github } from '$lib/server/auth';

import type { RequestEvent } from '@sveltejs/kit';

export async function GET(event: RequestEvent) {
	const state = generateState();
	const url = github.createAuthorizationURL(state, ['repo']);

	event.cookies.set('github_oauth_state', state, {
		path: '/',
		maxAge: 60 * 10
	});

	return new Response(null, {
		status: 302,
		headers: {
			Location: url.toString()
		}
	});
}
