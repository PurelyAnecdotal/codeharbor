import { redirect } from '@sveltejs/kit';

export function load({ locals, url }) {
	if (locals.user?.name !== null) redirect(302, '/');

	const ghName = new URLSearchParams(url.search).get('ghName');

	if (ghName !== null) return { ghName };

	return {};
}
