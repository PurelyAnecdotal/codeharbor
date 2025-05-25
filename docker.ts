import Dockerode from 'dockerode';

const docker = new Dockerode({});

const gitImage = 'cgr.dev/chainguard/git';

const serverImage = 'ghcr.io/linuxserver/openvscode-server:latest';

const cloneURL = Bun.argv[2];

const id = Math.random().toString(36).substring(2, 15);

console.log('Cloning repository');

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
	Entrypoint: ['/usr/bin/git', 'clone', cloneURL, '/home/git']
});

await git.start();

await git.wait();

git.remove();

console.log('Creating container');

const container = await docker.createContainer({
	Image: serverImage,
	name: `openvscode-server-${id}`,
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

console.log('Starting container');

await container.start();

const info = await container.inspect();

console.log(
	`http://${info.NetworkSettings.Networks['bridge'].IPAddress}:3000/?folder=/config/workspace`
);
