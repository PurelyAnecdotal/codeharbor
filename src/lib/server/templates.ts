import { tagged, wrapDB } from '$lib/error';
import { templates, users } from '$lib/server/db/schema';
import { githubRepoRegex, type Uuid } from '$lib/types';
import { desc, eq, getTableColumns } from 'drizzle-orm';
import { err, ok } from 'neverthrow';
import z from 'zod';
import { db } from './db';

export async function getTemplatesForUser(userUuid: Uuid) {
	const templatesResult = await wrapDB(
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
	wrapDB(
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
) => {
	return wrapDB(
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
};
