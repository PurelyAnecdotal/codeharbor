import { hideCause } from '$lib/error';
import { getUserGitHubRepos, initOctokit } from '$lib/server/octokit';
import { error, redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	const { user } = locals;

	if (!user) redirect(307, '/');

	const octokitResult = initOctokit(user.ghAccessToken);

	if (octokitResult.isErr()) {
		console.error('Failed to initialize Octokit:', octokitResult.error);
		error(500, 'Failed to initialize Octokit');
	}

	const octokit = octokitResult.value;

	return { repos: (await getUserGitHubRepos(octokit)).mapErr(hideCause) };
}
