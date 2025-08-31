import { zResult } from '$lib/result';
import { createTemplate, TemplateCreateOptions } from '$lib/server/templates';

export async function POST({ request, locals }) {
	if (locals.user === null) return new Response('Unauthorized', { status: 401 });

	const jsonResult = zResult(TemplateCreateOptions.safeParse(await request.json()));
	if (jsonResult.isErr()) {
		console.error('Invalid request body:', jsonResult.error);
		return new Response('Invalid request body', { status: 400 });
	}
	const { name, description, ghRepoName, ghRepoOwner } = jsonResult.value;

	const templateCreateResult = await createTemplate(
		{ name, description, ghRepoName, ghRepoOwner },
		locals.user.uuid
	);

	if (templateCreateResult.isErr()) {
		console.error('Failed to create template:', templateCreateResult.error);
		return new Response(`Failed to create template: ${templateCreateResult.error.message}`, {
			status: 500
		});
	}

	return new Response('Template created successfully', { status: 201 });
}
