import { wrapDB } from '$lib/error';
import {
	createSession,
	generateSessionToken,
	github,
	setSessionTokenCookie
} from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import type { RequestEvent } from '@sveltejs/kit';
import type { OAuth2Tokens } from 'arctic';
import { eq } from 'drizzle-orm';

export async function GET(event: RequestEvent) {
	const code = event.url.searchParams.get('code');
	const state = event.url.searchParams.get('state');
	const storedState = event.cookies.get('github_oauth_state') ?? null;

	if (code === null || state === null || storedState === null || state !== storedState)
		return new Response(null, { status: 400 });

	let tokens: OAuth2Tokens;
	try {
		tokens = await github.validateAuthorizationCode(code);
	} catch (e) {
		return new Response(null, { status: 400 });
	}
	const githubUserResponse = await fetch('https://api.github.com/user', {
		headers: {
			Authorization: `Bearer ${tokens.accessToken()}`
		}
	});
	const githubUser = await githubUserResponse.json();
	const githubUserId = githubUser.id;
	const githubUsername = githubUser.login;
	const githubName = githubUser.name;

	const existingUserResult = await getUserFromGitHubId(githubUserId);

	if (existingUserResult.isErr()) {
		console.error('Failed to get user from database:', existingUserResult.error);
		return new Response('Database Error', { status: 500 });
	}

	if (existingUserResult.value) {
		const sessionToken = generateSessionToken();
		const session = await createSession(sessionToken, existingUserResult.value.uuid);

		setSessionTokenCookie(event, sessionToken, session.expiresAt);

		return new Response(null, {
			status: 302,
			headers: {
				Location: '/'
			}
		});
	}

	const userCreationResult = await createUser(
		githubUserId,
		githubUsername,
		githubName,
		tokens.accessToken()
	);

	if (userCreationResult.isErr()) {
		console.error('Failed to create user:', userCreationResult.error);
		return new Response('Database Error', { status: 500 });
	}

	const sessionToken = generateSessionToken();
	const session = await createSession(sessionToken, userCreationResult.value.uuid);
	setSessionTokenCookie(event, sessionToken, session.expiresAt);

	return new Response(null, {
		status: 302,
		headers: {
			Location: '/'
		}
	});
}

const getUserFromGitHubId = (ghId: number) =>
	wrapDB(db.select().from(users).where(eq(users.ghId, ghId))).map((select) => select[0]);

const createUser = (
	ghId: number,
	ghLogin: string,
	ghName: string | null,
	ghAccessToken: string
) => {
	const uuid = crypto.randomUUID();

	return wrapDB(db.insert(users).values({ uuid, ghId, ghLogin, ghName, ghAccessToken })).map(
		() => ({ uuid })
	);
};
