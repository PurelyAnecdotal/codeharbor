import { command, getRequestEvent } from '$app/server';
import { tagged } from '$lib/error';
import { dbResult, wrapDB } from '$lib/server/db';
import { templates } from '$lib/server/db/schema';
import {
	createTemplate as createTemplateInternal,
	TemplateCreateOptions
} from '$lib/server/templates';
import { zUuid } from '$lib/types';
import { eq } from 'drizzle-orm';
import { err, ok, safeTry } from 'neverthrow';

export const createTemplate = command(TemplateCreateOptions, (options) =>
	safeTry(async function* () {
		const { user } = getRequestEvent().locals;
		if (!user) return err(tagged('UnauthorizedError'));

		yield* createTemplateInternal(options, user.uuid);

		return ok();
	}).orTee(console.error)
);

export const deleteTemplate = command(zUuid(), (templateUuid) =>
	safeTry(async function* () {
		const { user } = getRequestEvent().locals;
		if (!user) return err(tagged('UnauthorizedError'));

		const db = yield* dbResult;

		const [template] = yield* wrapDB(
			db
				.select({ ownerUuid: templates.ownerUuid })
				.from(templates)
				.where(eq(templates.uuid, templateUuid))
		);

		if (!template) return err(tagged('TemplateNotFoundError'));

		if (template.ownerUuid !== user.uuid) return err(tagged('UnauthorizedError'));

		yield* wrapDB(db.delete(templates).where(eq(templates.uuid, templateUuid)));

		return ok();
	}).orTee(console.error)
);
