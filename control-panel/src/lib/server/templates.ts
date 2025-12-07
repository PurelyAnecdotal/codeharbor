import { tagged } from '$lib/error';
import { safeFetch } from '$lib/fetch';
import { JSONSafeParse, zResult } from '$lib/result';
import { useDB } from '$lib/server/db';
import { templates, users } from '$lib/server/db/schema';
import {
	containerArchive,
	containerLogs,
	imageInspect,
	runTempContainer
} from '$lib/server/docker';
import { dockerSocketPath, openvscodeServerMountPath } from '$lib/server/config';
import { cloneGitRepoIntoVolume } from '$lib/server/workspaces';
import { githubRepoRegex, zPort, type Uuid } from '$lib/types';
import { desc, eq, getTableColumns } from 'drizzle-orm';
import { err, ok, safeTry } from 'neverthrow';
import { Readable } from 'node:stream';
import * as tar from 'tar-stream';
import z from 'zod';

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
	devcontainer: z.boolean().optional(),
	portLabels: z.array(z.tuple([zPort(), z.string()])).optional()
});

export type TemplateCreateOptions = z.infer<typeof TemplateCreateOptions>;

export const createTemplate = (
	{
		name,
		description,
		ghRepoName,
		ghRepoOwner,
		devcontainer,
		portLabels: portLabelsEntries
	}: TemplateCreateOptions,
	ownerUuid: Uuid
) =>
	safeTry(async function* () {
		if (
			name.length === 0 ||
			name.length > 50 ||
			(description !== undefined && description.length > 500)
		)
			return err(tagged('FormValidationError'));
		if (description?.length === 0) description = undefined;

		const templateUuid = crypto.randomUUID();
		let builtImageName: string | undefined = undefined;
		let prebuiltExtensionsDirectory: string | undefined = undefined;

		let portLabels: Record<string, string> = Object.fromEntries(portLabelsEntries ?? []);

		if (devcontainer === true) {
			const gitCloneUrl = `https://github.com/${ghRepoOwner}/${ghRepoName}.git`;

			const volumeName = `codeharbor-template-${templateUuid}`;

			builtImageName = `codeharbor-template-${templateUuid}`;

			console.log(`Cloning git repo ${gitCloneUrl} into volume ${volumeName}`);

			yield* cloneGitRepoIntoVolume(gitCloneUrl, volumeName);

			console.log(`Building devcontainer image for template ${name}`);

			const { id: devcontainerCliId, remove: removeTempContainer } = yield* runTempContainer({
				name: `codeharbor-template-builder-${templateUuid}`,
				Image: 'devcontainer-cli',
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
							Source: dockerSocketPath,
							Target: '/var/run/docker.sock'
						}
					]
				}
			});

			const logs = (yield* containerLogs(devcontainerCliId, {
				tail: 1,
				follow: false,
				stdout: true
			})).toString();

			removeTempContainer();

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

			console.log(`Built devcontainer image ${builtImageName} successfully.`);

			const metadata = yield* getDevcontainerImageMetadata(builtImageName);

			const extensions = metadata.flatMap((m) => m.customizations?.vscode?.extensions ?? []);

			if (extensions.length > 0) {
				prebuiltExtensionsDirectory = '/extensions';
				console.log(
					`Building ${extensions.length} extensions into image ${builtImageName}:\n - ${extensions.join('\n - ')}`
				);
				yield* buildExtensionsIntoImage(extensions, prebuiltExtensionsDirectory, builtImageName);
			}

			const devcontainerPortLabels: Record<string, string> = Object.fromEntries(
				Object.entries(
					metadata
						.flatMap((m) => (m.portsAttributes ? [m.portsAttributes] : []))
						.reduce((acc, curr) => ({ ...acc, ...curr }), {})
				).flatMap(([portString, { label }]) => {
					const port = zResult(zPort().safeParse(Number(portString)));
					if (port.isErr()) return [];

					if (label === undefined) return [];

					return [[port.value, label] as const];
				})
			);

			portLabels = { ...devcontainerPortLabels, ...portLabels };
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
				devcontainerImage: builtImageName,
				prebuiltExtensionsDirectory,
				portLabelsJson: portLabels
			})
		);

		return ok();
	});

const DevcontainerBuildCliOutputSchema = z.object({
	outcome: z.literal('success'),
	imageName: z.array(z.string())
});

export const DevcontainerImageMetadataSubset = z.array(
	z.object({
		id: z.string().optional(),
		entrypoint: z.string().optional(),
		customizations: z
			.object({
				vscode: z
					.object({
						extensions: z.array(z.string()).optional()
					})
					.optional()
			})
			.optional(),
		containerUser: z.string().optional(),
		remoteUser: z.string().optional(),
		portsAttributes: z
			.record(
				z.string(),
				z.object({
					label: z.string().optional()
				})
			)
			.optional()
	})
);

export const getDevcontainerImageMetadata = (imageName: string) =>
	safeTry(async function* () {
		const image = yield* imageInspect(imageName);

		const metadata = image.Config.Labels['devcontainer.metadata'];
		if (metadata === undefined) return err(tagged('ImageDevcontainerMetadataMissingError'));

		const parsedMetadataResult = DevcontainerImageMetadataSubset.safeParse(
			yield* JSONSafeParse(metadata)
		);

		if (!parsedMetadataResult.success)
			return err(tagged('ImageDevcontainerMetadataParseError', parsedMetadataResult.error));

		return ok(parsedMetadataResult.data);
	});

const textDecoder = new TextDecoder();

const buildExtensionsIntoImage = (
	extensions: string[],
	extensionsDirectory: string,
	imageTag: string
) =>
	safeTry(async function* () {
		if (openvscodeServerMountPath === undefined)
			return err(tagged('OpenVSCodeServerMountPathNotSet'));

		const { id: extensionContainerId, remove: removeTempContainer } = yield* runTempContainer({
			Image: 'mcr.microsoft.com/devcontainers/base:ubuntu',
			name: `codeharbor-extension-builder-${imageTag}`,
			HostConfig: {
				Mounts: [
					{
						Type: 'bind',
						Source: openvscodeServerMountPath,
						Target: '/openvscode-server',
						ReadOnly: true
					}
				],
				Init: true
			},
			Entrypoint: ['/bin/sh'],
			Cmd: [
				'-c',
				`for e in ${extensions.map((e) => `"${e}"`).join(' ')}; do
					/openvscode-server/bin/openvscode-server --install-extension "$e" --extensions-dir /extensions
				done
				chown -R 1000:1000 /extensions
				`,
				'--'
			]
		});

		const extensionsTarStream = yield* containerArchive(extensionContainerId, '/extensions');

		removeTempContainer();

		console.log('Repacking tar');

		const extractStream = tar.extract();
		const packStream = tar.pack();

		extractStream.on('entry', (header, stream, callback) => {
			stream.pipe(packStream.entry(header, callback));
		});

		extractStream.on('finish', () => {
			packStream.entry(
				{ name: 'Dockerfile' },
				`FROM ${imageTag}
				COPY extensions ${extensionsDirectory}`,
				(err) => {
					if (err) throw err;
					packStream.finalize();
				}
			);
		});

		extensionsTarStream.pipe(extractStream);

		console.log(`Building new image ${imageTag} with extensions...`);

		const query = new URLSearchParams({ t: imageTag, version: '2' });
		const res = yield* await safeFetch(`http://localhost/v1.49/build?${query}`, {
			unix: dockerSocketPath,
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-tar'
			},
			body: Readable.toWeb(packStream, {
				strategy: { highWaterMark: 32 * 1024 }
			}) as unknown as ReadableStream<Uint8Array>
		});

		if (!res.ok) return err(tagged('DevcontainerExtensionImageBuildError', await res.text()));
		if (res.body === null)
			return err(tagged('DevcontainerExtensionImageBuildError', 'Body is empty'));

		for await (const chunk of streamAsyncIterable(res.body)) {
			console.log(textDecoder.decode(chunk, { stream: true }));
		}

		console.log(`Built image ${imageTag} with extensions successfully.`);

		return ok();
	});

async function* streamAsyncIterable(stream: ReadableStream<Uint8Array>) {
	const reader = stream.getReader();
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) return;
			yield value;
		}
	} finally {
		reader.releaseLock();
	}
}
