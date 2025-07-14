import { hideCause, tagged } from '$lib/error';
import { octokit } from '$lib/octokit';
import { redirect } from '@sveltejs/kit';
import { ResultAsync } from 'neverthrow';

export async function load({ locals}) {
	const { user } = locals;

	if (!user) redirect(307, '/');

	return { repos: (await getUserGitHubRepos(user.ghAccessToken)).mapErr(hideCause) };
}

const getUserGitHubRepos = (accessToken: string) =>
	octokit(accessToken)
		.asyncAndThen((octokit) =>
			ResultAsync.fromPromise(octokit.rest.repos.listForAuthenticatedUser(), (err) =>
				tagged('OctokitError', err)
			)
		)
		.map((res) => res.data);
