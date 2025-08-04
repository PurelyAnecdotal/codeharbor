export function load({ locals }) {
	if (!locals.user) return;

	const { uuid, name, ghId, ghLogin, } = locals.user;

	// also edit in src/app.d.ts
	return {
		user: { uuid, name, ghId, ghLogin }
	};
}
