import { tagged } from '$lib/error';
import { JSONSafeParse } from '$lib/result';
import { useDB } from '$lib/server/db';
import { templates, users } from '$lib/server/db/schema';
import {
	containerCreate,
	containerInspect,
	containerLogs,
	containerRemove,
	containerStart,
	containerWait
} from '$lib/server/docker';
import { cloneGitRepoIntoVolume } from '$lib/server/workspaces';
import { githubRepoRegex, type Uuid } from '$lib/types';
import { desc, eq, getTableColumns } from 'drizzle-orm';
import { err, ok, safeTry } from 'neverthrow';
import z from 'zod';
import { dockerSocketPath } from './env';

export async function getTemplatesForUser(userUuid: Uuid) {
	const templatesResult = await useDB((db) =>
		db
			.select({
				...getTableColumns(templates),
				owner: {
					uuid: users.uuid,
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
	ghRepoName: z.string().regex(githubRepoRegex),
	devcontainer: z.boolean().optional()
});

export type TemplateCreateOptions = z.infer<typeof TemplateCreateOptions>;

export const createTemplate = (
	{ name, description, ghRepoName, ghRepoOwner, devcontainer }: TemplateCreateOptions,
	ownerUuid: Uuid
) =>
	safeTry(async function* () {
		if (
			name.length === 0 ||
			name.length > 50 ||
			(description !== undefined && description.length > 500)
		)
			return err(tagged('FormValidationError'));
		if (description !== undefined && description.length === 0) description = undefined;

		const templateUuid = crypto.randomUUID();
		let builtImageName: string | undefined = undefined;

		if (devcontainer) {
			const gitCloneUrl = `https://github.com/${ghRepoOwner}/${ghRepoName}.git`;

			const volumeName = `codeharbor-template-${templateUuid}`;

			builtImageName = `codeharbor-template-${templateUuid}`;

			yield* cloneGitRepoIntoVolume(gitCloneUrl, volumeName);

			const devcontainerCli = yield* containerCreate({
				name: `codeharbor-template-builder-${templateUuid}`,
				Image: 'devcontainercli',
				Cmd: ['build', '--workspace-folder', '/workspace', '--image-name', builtImageName],
				HostConfig: {
					Mounts: [
						{
							Type: 'volume',
							Source: volumeName,
							Target: '/workspace'
						},
						{
							Type: 'bind',
							Source: dockerSocketPath ?? '/var/run/docker.sock',
							Target: '/var/run/docker.sock'
						}
					]
				}
			});

			yield* containerStart(devcontainerCli.id);
			yield* containerWait(devcontainerCli.id);

			const devcontainerCliInfo = yield* containerInspect(devcontainerCli.id);
			if (devcontainerCliInfo.State.ExitCode !== 0)
				return err(tagged('DevcontainerCliError', devcontainerCliInfo.State.Error));

			const logs = (yield* containerLogs(devcontainerCli.id, {
				tail: 1,
				follow: false,
				stdout: true
			})).toString();

			const outputJson = logs.slice(logs.indexOf('{'));

			const outputParseResult = DevcontainerBuildCliOutputSchema.safeParse(
				yield* JSONSafeParse(outputJson).mapErr(({ cause }) =>
					tagged('DevcontainerCliOutputParseError', cause)
				)
			);
			if (!outputParseResult.success)
				return err(tagged('DevcontainerCliOutputParseError', outputParseResult.error));
			const output = outputParseResult.data;

			if (!output.imageName.includes(builtImageName))
				return err(
					tagged(
						'DevcontainerCliError',
						`Specified image name ${builtImageName} is not in returned image name(s) ${output.imageName}`
					)
				);

			containerRemove(devcontainerCli.id).orTee((err) =>
				console.error('Failed to remove devcontainer cli container:', err)
			);
		}

		yield* useDB((db) =>
			db.insert(templates).values({
				uuid: templateUuid,
				name,
				description,
				ownerUuid,
				createdAt: new Date(),
				ghRepoName,
				ghRepoOwner,
				devcontainerImage: builtImageName
			})
		);

		return ok();
	});

const DevcontainerBuildCliOutputSchema = z.object({
	outcome: z.literal('success'),
	imageName: z.tuple([z.string()])
});
