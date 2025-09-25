import { zResult } from '$lib/result';
import { initOctokit } from '$lib/server/octokit';
import { createWorkspace, WorkspaceCreateOptions } from '$lib/server/workspaces';

export async function POST({ request, locals }) {
	const { user } = locals;
	if (!user) return new Response('Unauthorized', { status: 401 });

	const jsonResult = zResult(WorkspaceCreateOptions.safeParse(await request.json()));
	if (jsonResult.isErr()) {
		console.error('Invalid request body:', jsonResult.error);
		return new Response('Invalid request body', { status: 400 });
	}
	const { name, source } = jsonResult.value;

	const octokitResult = initOctokit(user.ghAccessToken);
	if (octokitResult.isErr()) {
		console.error('Failed to initialize Octokit:', octokitResult.error);
		return new Response('Failed to initialize Octokit', { status: 500 });
	}
	const octokit = octokitResult.value;

	const workspaceCreateResult = await createWorkspace(
		{ name, source },
		user.uuid,
		octokit,
		user.ghAccessToken
	);

	if (workspaceCreateResult.isErr()) {
		console.error('Failed to create workspace:', workspaceCreateResult.error);
		return new Response(`Failed to create workspace: ${workspaceCreateResult.error.message}`, {
			status: 500
		});
	}

	return new Response('Workspace created successfully', { status: 201 });
}
