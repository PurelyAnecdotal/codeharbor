import { useDB } from '$lib/server/db';
import { templates, users, workspaces } from '$lib/server/db/schema';
import { isUuid, type Uuid } from '$lib/types';
import { error, redirect } from '@sveltejs/kit';
import { count, eq, getTableColumns } from 'drizzle-orm';
import { friendlyWords } from 'friendlier-words';

export async function load({ locals, params }) {
	if (locals.user === null) redirect(307, '/');

	if (!isUuid(params.templateUuid)) error(400, 'Invalid template UUID');

	const templateResult = await getTemplateWithOwner(params.templateUuid);
	if (templateResult.isErr()) {
		console.error('Failed to fetch template:', templateResult.error);
		error(500, 'Failed to fetch template');
	} else if (templateResult.value === undefined) {
		console.error('Template not found:', params.templateUuid);
		error(404, 'Template not found');
	}

	return {
		template: templateResult.value,
		existingWorkspacesWithTemplate: await countWorkspacesWithTemplate(params.templateUuid)
			.orTee(console.error)
			.unwrapOr(0),
		randomName: friendlyWords()
	};
}

const countWorkspacesWithTemplate = (templateUuid: Uuid) =>
	useDB((db) =>
		db.select({ count: count() }).from(workspaces).where(eq(workspaces.templateUuid, templateUuid))
	).map((result) => result[0]?.count ?? 0);

const getTemplateWithOwner = (templateUuid: Uuid) =>
	useDB((db) =>
		db
			.select({
				...getTableColumns(templates),
				owner: {
					name: users.name,
					ghId: users.ghId
				}
			})
			.from(templates)
			.where(eq(templates.uuid, templateUuid))
			.innerJoin(users, eq(templates.ownerUuid, users.uuid))
	).map((result) => result[0]);
