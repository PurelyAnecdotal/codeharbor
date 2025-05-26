import { db } from '$lib/server/db/index.js';
import { workspaces } from '$lib/server/db/schema.js';
import { docker } from '$lib/server/docker.js';

const gitImage = 'cgr.dev/chainguard/git';

const serverImage = 'ghcr.io/linuxserver/openvscode-server:latest';

export async function POST({ request, locals }) {
	const session = await locals.auth();

	if (!session || !session.id || !session.accessToken) {
		return new Response('Unauthorized', { status: 401 });
	}

	const { cloneURL, name } = await request.json();

	try {
		const url = new URL(cloneURL);
		if (url.protocol !== 'https:') throw new Error('Invalid protocol');
	} catch {
		return new Response('Invalid clone url', { status: 400 });
	}

	const id = Math.random().toString(36).substring(2, 15);
	// const id = crypto.randomUUID();

	const authenticatedURL = `https://${session.accessToken}@github.com${new URL(cloneURL).pathname}`;

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
		Entrypoint: ['/usr/bin/git', 'clone', authenticatedURL, '/home/git']
	});

	await git.start();

	await git.wait();

	git.remove();

	console.log('Creating container');

	const container = await docker.createContainer({
		Image: serverImage,
		name: `annex-code-server-${id}`,
		Env: ['CODE_ARGS=--server-base-path /instance'],
		HostConfig: {
			Mounts: [
				{
					Type: 'volume',
					Source: `annex-${id}`,
					Target: '/config/workspace'
				}
			]
		}
	});

	await db.insert(workspaces).values({
		uuid: id,
		name: name,
		ownerId: session.id,
		dockerId: container.id,
		repoURL: cloneURL
	});

	console.log('Starting container');

	await container.start();

	const info = await container.inspect();

	console.log(
		`http://${info.NetworkSettings.Networks['bridge'].IPAddress}:3000/?folder=/config/workspace`
	);

	return new Response('Container created successfully', { status: 200 });
}
