import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	const session = await locals.auth();

	if (session && session.id) redirect(307, '/home');
}
