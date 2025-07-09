import { requireLogin } from '$lib/auth';
import { hideCause, tagged } from '$lib/error';
import { octokit } from '$lib/octokit';
import { ResultAsync } from 'neverthrow';

export async function load() {
	const session = await requireLogin();

	return { repos: (await getUserGitHubRepos(session.accessToken!)).mapErr(hideCause) };
}

const getUserGitHubRepos = (accessToken: string) =>
	octokit(accessToken)
		.asyncAndThen((octokit) =>
			ResultAsync.fromPromise(octokit.rest.repos.listForAuthenticatedUser(), (err) =>
				tagged('OctokitError', err)
			)
		)
		.map((res) => res.data);
