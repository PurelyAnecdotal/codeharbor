import { wrapDockerode } from '$lib/error';
import Dockerode from 'dockerode';

export const docker = new Dockerode();

export const getDockerContainersList = () => wrapDockerode(docker.listContainers({ all: true }));

export const containerCreate = (createOptions: Dockerode.ContainerCreateOptions) =>
	wrapDockerode(docker.createContainer(createOptions));

export const containerStart = (
	containerId: string,
	startOptions?: Dockerode.ContainerStartOptions
) => wrapDockerode(docker.getContainer(containerId).start(startOptions));

export const containerStop = (containerId: string, stopOptions?: Dockerode.ContainerStopOptions) =>
	wrapDockerode(docker.getContainer(containerId).stop(stopOptions));

export const containerRemove = (
	containerId: string,
	removeOptions?: Dockerode.ContainerRemoveOptions
) => wrapDockerode(docker.getContainer(containerId).remove(removeOptions));

export const containerInspect = (
	containerId: string,
	inspectOptions?: Dockerode.ContainerInspectOptions
) => wrapDockerode(docker.getContainer(containerId).inspect(inspectOptions));

export const containerStats = (containerId: string) =>
	wrapDockerode(docker.getContainer(containerId).stats({ stream: false, 'one-shot': true }));

export const containerWait = (containerId: string, waitOptions?: Dockerode.ContainerWaitOptions) =>
	wrapDockerode(docker.getContainer(containerId).wait(waitOptions));

export function calculateContainerResourceUsage({
	cpu_stats,
	precpu_stats,
	memory_stats
}: Dockerode.ContainerStats) {
	let cpuUsage: number | undefined;
	if (cpu_stats.system_cpu_usage && precpu_stats.system_cpu_usage && cpu_stats.online_cpus) {
		const cpuDelta = cpu_stats.cpu_usage.total_usage - precpu_stats.cpu_usage.total_usage;
		const systemCpuDelta = cpu_stats.system_cpu_usage - precpu_stats.system_cpu_usage;
		cpuUsage = (cpuDelta / systemCpuDelta) * cpu_stats.online_cpus;
	}

	let memoryUsage: number | undefined;
	if ('usage' in memory_stats && 'stats' in memory_stats) {
		const usedMemory = memory_stats.usage - memory_stats.stats.inactive_file;
		memoryUsage = usedMemory / memory_stats.limit;
	}

	return { cpuUsage, memoryUsage };
}
