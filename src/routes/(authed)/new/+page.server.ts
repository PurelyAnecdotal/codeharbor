import { Octokit } from '@octokit/rest';

export async function load({ locals }) {
    const session = await locals.auth();

    const octokit = new Octokit({
        auth: session?.accessToken,
        userAgent: 'annex/0.0 development'
    });

    const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser();

    return { repos };
}
