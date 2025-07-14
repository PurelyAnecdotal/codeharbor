export function load({ locals }) {
	if (!locals.user) return;

	const { ghLogin, ghName } = locals.user;

	return {
		user: { ghLogin, ghName }
	};
}
