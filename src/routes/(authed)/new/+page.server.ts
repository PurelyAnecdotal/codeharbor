import { requireLogin } from '$lib/auth';
import { maskResult } from '$lib/error.js';
import { RequestError } from '@octokit/request-error';
import { Octokit } from '@octokit/rest';
import { Result, ResultAsync } from 'neverthrow';

export async function load() {
	const session = await requireLogin();

	return { repos: maskResult(await getUserGitHubRepos(session.accessToken!)) };
}

const getUserGitHubRepos = (accessToken: string) =>
	Result.fromThrowable(
		(...rest) => new Octokit(...rest),
		(err) => err as RequestError
	)({ auth: accessToken, userAgent: 'annex/0.0' })
		.asyncAndThen((octokit) =>
			ResultAsync.fromPromise(
				octokit.rest.repos.listForAuthenticatedUser(),
				(err) => err as RequestError
			)
		)
		.map((res) => res.data);
