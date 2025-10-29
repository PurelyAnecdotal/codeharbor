import { getTemplatesForUser } from '$lib/server/templates.js';
import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	const { user } = locals;

	if (!user) redirect(307, '/');

	return {
		templates: await getTemplatesForUser(user.uuid)
	};
}
