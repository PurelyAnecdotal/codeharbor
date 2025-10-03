import { command, getRequestEvent } from '$app/server';
import { tagged } from '$lib/error';
import { RAtoJ } from '$lib/result';
import { dbResult, wrapDB } from '$lib/server/db';
import { templates } from '$lib/server/db/schema';
import { zUuid } from '$lib/types';
import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { err, ok, safeTry } from 'neverthrow';

export const deleteTemplate = command(zUuid(), (templateUuid) =>
	RAtoJ(
		safeTry(async function* () {
			const { user } = getRequestEvent().locals;
			if (!user) redirect(307, '/');

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
		})
	)
);
