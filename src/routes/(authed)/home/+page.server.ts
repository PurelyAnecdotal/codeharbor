import { docker } from '$lib/docker';

export async function load() {
	const containers = await docker.listContainers();
	return { containers };
}
