import type { DBError, DockerodeError2 } from '$lib/error.js';
import { db } from '$lib/server/db/index.js';
import { workspaces } from '$lib/server/db/schema.js';
import { docker } from '$lib/server/docker.js';
import { eq } from 'drizzle-orm';
import { ResultAsync } from 'neverthrow';

export async function POST({ locals, params }) {
	const session = await locals.auth();

	if (!session || !session.id || !session.accessToken)
		return new Response('Unauthorized', { status: 401 });

	const dbSelectResult = await ResultAsync.fromPromise(
		db
			.select({
				ownerId: workspaces.ownerId,
				dockerId: workspaces.dockerId
			})
			.from(workspaces)
			.where(eq(workspaces.uuid, params.uuid)),
		(err) => err as DBError
	);

	if (dbSelectResult.isErr()) return new Response('Database Error', { status: 500 });

	const dbResponse = dbSelectResult.value;

	if (dbResponse.length === 0 || !dbResponse[0])
		return new Response('Workspace not found', { status: 404 });

	const workspace = dbResponse[0];

	if (workspace.ownerId !== session.id) return new Response('Forbidden', { status: 403 });

	const dockerResult = await ResultAsync.fromPromise(
		docker.getContainer(workspace.dockerId).stop(),
		(err) => err as DockerodeError2
	);

	if (dockerResult.isErr()) {
		console.error('Failed to stop container:', dockerResult.error);
		return new Response('Failed to stop container', { status: 500 });
	}

	return new Response('Workspace stopped', { status: 200 });
}
