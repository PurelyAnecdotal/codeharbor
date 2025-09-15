import { safeFetch } from '$lib/fetch';
import {
	createSession,
	generateSessionToken,
	github,
	setSessionTokenCookie
} from '$lib/server/auth';
import { useDB } from '$lib/server/db';
import { blockedUsers, users } from '$lib/server/db/schema';
import type { RequestEvent } from '@sveltejs/kit';
import type { OAuth2Tokens } from 'arctic';
import { eq } from 'drizzle-orm';
import * as z from 'zod';

const GithubUser = z.object({
	id: z.number(),
	login: z.string(),
	name: z.string().nullable()
});

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

	const githubUserResponseResult = await safeFetch('https://api.github.com/user', {
		headers: {
			Authorization: `Bearer ${tokens.accessToken()}`
		}
	});
	if (githubUserResponseResult.isErr()) {
		console.error('Failed to fetch GitHub user:', githubUserResponseResult.error);
		return new Response('GitHub API Error', { status: 500 });
	}

	const githubUserData = GithubUser.safeParse(await githubUserResponseResult.value.json());
	if (!githubUserData.success) {
		console.error('Invalid GitHub user data:', githubUserData.error);
		return new Response('Invalid GitHub User Data', { status: 500 });
	}

	const { id: githubUserId, login: githubUsername, name: githubName } = githubUserData.data;

	const blockedResult = await useDB((db) =>
		db.select().from(blockedUsers).where(eq(blockedUsers.ghId, githubUserId))
	).map((select) => (select[0] !== undefined ? true : false));
	if (blockedResult.isErr()) {
		console.error('Failed to check if user is blocked:', blockedResult.error);
		return new Response('Database Error', { status: 500 });
	}
	if (blockedResult.value) {
		console.warn(`Blocked user attempted to log in: ${githubUsername} (${githubUserId})`);
		return new Response('You are blocked from using this service.', { status: 403 });
	}

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

	const userCreationResult = await createUser({
		ghId: githubUserId,
		ghLogin: githubUsername,
		ghAccessToken: tokens.accessToken()
	});

	if (userCreationResult.isErr()) {
		console.error('Failed to create user:', userCreationResult.error);
		return new Response('Database Error', { status: 500 });
	}

	const sessionToken = generateSessionToken();
	const session = await createSession(sessionToken, userCreationResult.value.uuid);
	setSessionTokenCookie(event, sessionToken, session.expiresAt);

	let redirectUrl = '/welcome';

	if (githubName) redirectUrl += `?${new URLSearchParams([['ghName', githubName]])}`;

	return new Response(null, {
		status: 302,
		headers: {
			Location: redirectUrl
		}
	});
}

const getUserFromGitHubId = (ghId: number) =>
	useDB((db) => db.select().from(users).where(eq(users.ghId, ghId))).map((select) => select[0]);

interface UserCreateOptions {
	name?: string;
	ghId: number;
	ghLogin: string;
	ghAccessToken: string;
}

function createUser(options: UserCreateOptions) {
	const uuid = crypto.randomUUID();

	return useDB((db) => db.insert(users).values({ uuid, ...options })).map(() => ({ uuid }));
}
