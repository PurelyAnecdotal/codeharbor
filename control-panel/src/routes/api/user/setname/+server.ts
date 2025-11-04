import { useDB } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { letterRegex, nameRegex } from '$lib/types';
import { eq } from 'drizzle-orm';

export async function POST({ request, locals }) {
	if (locals.user === null) return new Response('Unauthorized', { status: 401 });

	const authedUserUuid = locals.user.uuid;
	const newName = await request.text();

	if (!nameRegex.test(newName) || !letterRegex.test(newName))
		return new Response('Name failed validation', { status: 400 });

	const updateResult = await useDB((db) =>
		db.update(users).set({ name: newName }).where(eq(users.uuid, authedUserUuid))
	);

	if (updateResult.isErr()) return new Response('Failed to update name', { status: 500 });

	locals.user.name = newName;

	return new Response('Name updated successfully');
}
