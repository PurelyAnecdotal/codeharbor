export function load({ locals }) {
	if (!locals.user) return;

	const { uuid, ghId, ghLogin, ghName } = locals.user;

	// also edit in src/app.d.ts
	return {
		user: { uuid, ghId, ghLogin, ghName }
	};
}
