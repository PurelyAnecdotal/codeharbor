import { tagged } from '$lib/error';
import { db } from '$lib/server/db/index.js';
import * as table from '$lib/server/db/schema.js';
import { docker } from '$lib/server/docker.js';
import { isUuid } from '$lib/types.js';
import { eq } from 'drizzle-orm';
import { ResultAsync } from 'neverthrow';

export async function DELETE({ locals, params }) {
	const { user } = locals;

	if (!user) return new Response('Unauthorized', { status: 401 });

	if (!isUuid(params.uuid)) return new Response('Invalid UUID format', { status: 400 });

	const dbSelectResult = await ResultAsync.fromPromise(
		db
			.select({
				ownerUuid: table.workspace.ownerUuid,
				dockerId: table.workspace.dockerId
			})
			.from(table.workspace)
			.where(eq(table.workspace.uuid, params.uuid)),
		(err) => tagged('DBError', err)
	);

	if (dbSelectResult.isErr()) return new Response('Database Error', { status: 500 });

	const dbResponse = dbSelectResult.value;

	if (dbResponse.length === 0 || !dbResponse[0])
		return new Response('Workspace not found', { status: 404 });

	const workspace = dbResponse[0];

	if (workspace.ownerUuid !== user.uuid) return new Response('Forbidden', { status: 403 });

	const dockerResult = await ResultAsync.fromPromise(
		docker.getContainer(workspace.dockerId).remove(),
		(err) => tagged('DockerodeError', err)
	);

	if (dockerResult.isErr()) {
		console.error('Failed to remove container:', dockerResult.error);
		return new Response('Failed to remove container', { status: 500 });
	}

	const dbDeleteResult = await ResultAsync.fromPromise(
		db.delete(table.workspace).where(eq(table.workspace.uuid, params.uuid)),
		(err) => tagged('DBError', err)
	);

	if (dbDeleteResult.isErr()) {
		console.error('Failed to delete workspace from database:', dbDeleteResult.error);
		return new Response('Failed to delete workspace from database', { status: 500 });
	}

	return new Response('Workspace deleted', { status: 200 });
}
