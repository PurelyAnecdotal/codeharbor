import { tagged } from '$lib/error';
import { useDB } from '$lib/server/db';
import { templates, users } from '$lib/server/db/schema';
import { githubRepoRegex, type Uuid } from '$lib/types';
import { desc, eq, getTableColumns } from 'drizzle-orm';
import { err, ok } from 'neverthrow';
import z from 'zod';

export async function getTemplatesForUser(userUuid: Uuid) {
	const templatesResult = await useDB((db) =>
		db
			.select({
				...getTableColumns(templates),
				owner: {
					name: users.name,
					ghId: users.ghId
				}
			})
			.from(templates)
			.innerJoin(users, eq(templates.ownerUuid, users.uuid))
			.orderBy(desc(templates.createdAt))
	);

	if (templatesResult.isErr()) {
		console.error('Failed to fetch templates:', templatesResult.error);
		return [];
	}

	return templatesResult.value;
}

export const getGhRepoNameFromTemplate = (templateUuid: Uuid) =>
	useDB((db) =>
		db
			.select({ ghRepoOwner: templates.ghRepoOwner, ghRepoName: templates.ghRepoName })
			.from(templates)
			.where(eq(templates.uuid, templateUuid))
	)
		.map((select) => select[0])
		.andThen((value) => {
			if (value === undefined) return err(tagged('TemplateNotFoundError'));
			return ok(value);
		});

export const TemplateCreateOptions = z.object({
	name: z.string(),
	description: z.string().optional(),
	ghRepoOwner: z.string().regex(githubRepoRegex),
	ghRepoName: z.string().regex(githubRepoRegex)
});

export type TemplateCreateOptions = z.infer<typeof TemplateCreateOptions>;

export const createTemplate = (
	{ name, description, ghRepoName, ghRepoOwner }: TemplateCreateOptions,
	ownerUuid: Uuid
) =>
	useDB((db) =>
		db.insert(templates).values({
			uuid: crypto.randomUUID(),
			name,
			description,
			ownerUuid,
			createdAt: new Date(),
			ghRepoName,
			ghRepoOwner
		})
	);
