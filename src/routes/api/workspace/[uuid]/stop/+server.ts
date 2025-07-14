import { tagged } from '$lib/error.js';
import { db } from '$lib/server/db/index.js';
import * as table from '$lib/server/db/schema.js';
import { docker } from '$lib/server/docker.js';
import { isUuid } from '$lib/types';
import { eq } from 'drizzle-orm';
import { ResultAsync } from 'neverthrow';

export async function POST({ locals, params }) {
	const { user } = locals;

	if (!user) return new Response('Unauthorized', { status: 401 });

	if (!isUuid(params.uuid)) return new Response('Invalid UUID format', { status: 400 });

	const dbSelectResult = await ResultAsync.fromPromise(
		db
			.select({
				ownerUuid: table.workspace.ownerUuid,
				sharedUserUuids: table.workspace.sharedUserUuids,
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

	if (workspace.ownerUuid !== user.uuid && !workspace.sharedUserUuids.includes(user.uuid))
		return new Response('Forbidden', { status: 403 });

	const dockerResult = await ResultAsync.fromPromise(
		docker.getContainer(workspace.dockerId).stop(),
		(err) => tagged('DockerodeError', err)
	);

	if (dockerResult.isErr()) {
		console.error('Failed to stop container:', dockerResult.error);
		return new Response('Failed to stop container', { status: 500 });
	}

	return new Response('Workspace stopped', { status: 200 });
}
