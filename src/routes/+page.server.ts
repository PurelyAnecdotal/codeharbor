import { docker } from '$lib/docker';
import { Octokit } from '@octokit/rest';

export async function load({ locals }) {
	const session = await locals.auth();

	const octokit = new Octokit({
		auth: session?.accessToken,
		userAgent: 'annex/0.0 development'
	});

	const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser();

	const containers = await docker.listContainers();
	return { containers, repos };
}
