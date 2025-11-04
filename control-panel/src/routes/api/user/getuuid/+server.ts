export async function GET({ locals }) {
	if (locals.user === null) return new Response('Unauthorized', { status: 401 });

	return new Response(locals.user.uuid);
}
