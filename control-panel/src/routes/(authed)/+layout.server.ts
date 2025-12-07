import { redirect } from '@sveltejs/kit';

export const load = ({ locals, route }) => {
	if (!locals.user) return redirect(302, '/');

	if (locals.user.name === null && route.id !== '/(authed)/welcome')
		return redirect(302, `/welcome`);
};
