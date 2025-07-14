import { OPENVSCODE_SERVER_MOUNT_PATH } from '$env/static/private';
import { db } from '$lib/server/db/index.js';
import { workspace } from '$lib/server/db/schema.js';
import { docker } from '$lib/server/docker.js';
import { friendlyWords } from 'friendlier-words';

const gitImage = 'cgr.dev/chainguard/git';

export async function POST({ request, locals }) {
	if (OPENVSCODE_SERVER_MOUNT_PATH === undefined || OPENVSCODE_SERVER_MOUNT_PATH === '')
		return new Response('OPENVSCODE_SERVER_MOUNT_PATH is not set', { status: 500 });

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

	const git = await docker.createContainer({
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
	await git.start();
	await git.wait();
	const gitInspect = await git.inspect();

	if (gitInspect.State?.ExitCode !== 0) {
		console.error(
			`Git clone failed with exit code ${gitInspect.State?.ExitCode}`,
			gitInspect.State.Error
		);
		return new Response('Failed to clone repository', { status: 500 });
	}

	git.remove();

	console.log(`Creating container`);

	const workspaceVolumeMountDir = `/config/workspace/${repoName}`;

	const container = await docker.createContainer({
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
			]
		},
		Entrypoint: [
			'/bin/sh',
			'-c',
			'exec /openvscode-server/bin/openvscode-server --host 0.0.0.0 --without-connection-token',
			'--'
		]
		// User: 'vscode'
	});

	await db.insert(workspace).values({
		uuid: id,
		name: friendlyWords(),
		ownerUuid: user.uuid,
		dockerId: container.id,
		repoURL: cloneURL,
		folder: workspaceVolumeMountDir
	});

	await container.start();

	return new Response('Container created successfully', { status: 200 });
}
