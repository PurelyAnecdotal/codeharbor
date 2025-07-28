import { OPENVSCODE_SERVER_MOUNT_PATH } from '$env/static/private';
import { wrapDB } from '$lib/error.js';
import { db } from '$lib/server/db';
import { workspaces } from '$lib/server/db/schema';
import {
	containerCreate,
	containerInspect,
	containerRemove,
	containerStart,
	containerWait
} from '$lib/server/docker';
import { friendlyWords } from 'friendlier-words';

const gitImage = 'cgr.dev/chainguard/git';

export async function POST({ request, locals }) {
	if (OPENVSCODE_SERVER_MOUNT_PATH === undefined || OPENVSCODE_SERVER_MOUNT_PATH === '')
		return new Response('The environment variable OPENVSCODE_SERVER_MOUNT_PATH is not set', {
			status: 500
		});

	const { user } = locals;
	if (!user) return new Response('Unauthorized', { status: 401 });

	const { cloneURL } = await request.json();

	let cloneURLObject: URL;
	try {
		cloneURLObject = new URL(cloneURL);
		if (cloneURLObject.protocol !== 'https:') throw new Error('Invalid protocol');
	} catch {
		return new Response('Invalid clone url', { status: 400 });
	}

	const id = crypto.randomUUID();

	const authenticatedURL = `https://${user.ghAccessToken}@github.com${cloneURLObject.pathname}`;
	const repoName =
		cloneURLObject.pathname
			.split('/')
			.pop()
			?.replace(/\.git$/, '') ?? 'repository';

	console.log(`Cloning repository ${repoName} from ${cloneURL}`);

	const gitContainerResult = await containerCreate({
		Image: gitImage,
		name: `annex-git-clone-${id}`,
		HostConfig: {
			Mounts: [
				{
					Type: 'volume',
					Source: `annex-${id}`,
					Target: '/home/git'
				}
			]
		},
		Entrypoint: ['/bin/sh', '-c', `exec /usr/bin/git clone ${authenticatedURL} /home/git`, '--']
	});
	if (gitContainerResult.isErr()) {
		console.error('Failed to create git container:', gitContainerResult.error);
		return new Response('Failed to create git container', { status: 500 });
	}

	const gitContainer = gitContainerResult.value;

	const containerStartResult = await containerStart(gitContainer.id);
	if (containerStartResult.isErr()) {
		console.error('Failed to start git container:', containerStartResult.error);
		return new Response('Failed to start git container', { status: 500 });
	}

	const containerWaitResult = await containerWait(gitContainer.id);
	if (containerWaitResult.isErr()) {
		console.error('Failed to wait for git container:', containerWaitResult.error);
		return new Response('Failed to wait for git container', { status: 500 });
	}

	const gitContainerInspectInfoResult = await containerInspect(gitContainer.id);
	if (gitContainerInspectInfoResult.isErr()) {
		console.error('Failed to inspect git container:', gitContainerInspectInfoResult.error);
		return new Response('Failed to inspect git container', { status: 500 });
	}

	const gitContainerInspectInfo = gitContainerInspectInfoResult.value;

	if (gitContainerInspectInfo.State?.ExitCode !== 0) {
		console.error(
			`Git clone failed with exit code ${gitContainerInspectInfo.State.ExitCode}`,
			gitContainerInspectInfo.State.Error
		);
		return new Response('Failed to clone repository', { status: 500 });
	}

	containerRemove(gitContainer.id).orTee((err) =>
		console.error('Failed to remove git container:', err)
	);

	console.log(`Creating container`);

	const workspaceVolumeMountDir = `/config/workspace/${repoName}`;

	const gibi = 1024 ** 3;
	const workspaceContainerResult = await containerCreate({
		Image: 'mcr.microsoft.com/devcontainers/base',
		name: `annex-code-server-${id}`,
		// Env: ['CODE_ARGS=--server-base-path /instance'],
		HostConfig: {
			Mounts: [
				{
					Type: 'volume',
					Source: `annex-${id}`,
					Target: workspaceVolumeMountDir
				},
				{
					Type: 'bind',
					Source: OPENVSCODE_SERVER_MOUNT_PATH,
					Target: '/openvscode-server',
					ReadOnly: true
				}
			],
			NanoCpus: 1 * 1e9,
			Memory: 1 * gibi
		},
		Entrypoint: [
			'/bin/sh',
			'-c',
			'exec /openvscode-server/bin/openvscode-server --host 0.0.0.0 --without-connection-token',
			'--'
		]
		// User: 'vscode'
	});
	if (workspaceContainerResult.isErr()) {
		console.error('Failed to create workspace container:', workspaceContainerResult.error);
		return new Response('Failed to create workspace container', { status: 500 });
	}

	const workspaceContainer = workspaceContainerResult.value;

	const dbInsertResult = await wrapDB(
		db.insert(workspaces).values({
			uuid: id,
			name: friendlyWords(),
			ownerUuid: user.uuid,
			dockerId: workspaceContainer.id,
			repoURL: cloneURL,
			folder: workspaceVolumeMountDir
		})
	);
	if (dbInsertResult.isErr()) {
		console.error('Failed to insert workspace into database:', dbInsertResult.error);
		return new Response('Failed to create workspace in database', { status: 500 });
	}

	await containerStart(workspaceContainer.id).orTee((err) =>
		console.error('Failed to start workspace container:', err)
	);

	return new Response('Container created successfully', { status: 200 });
}
