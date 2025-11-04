import { catchWithTag, tagged } from '$lib/error';
import { dockerSocketPath } from '$lib/server/config';
import Dockerode from 'dockerode';
import { err, ok, safeTry } from 'neverthrow';

export const docker = new Dockerode({ socketPath: dockerSocketPath });

export const listContainers = () =>
	catchWithTag(docker.listContainers({ all: true }), 'ContainersListError');

export const containerCreate = (createOptions: Dockerode.ContainerCreateOptions) =>
	catchWithTag(docker.createContainer(createOptions), 'ContainerCreateError');

export const containerStart = (
	containerId: string,
	startOptions?: Dockerode.ContainerStartOptions
) => catchWithTag(docker.getContainer(containerId).start(startOptions), 'ContainerStartError');

export const containerStop = (containerId: string, stopOptions?: Dockerode.ContainerStopOptions) =>
	catchWithTag(docker.getContainer(containerId).stop(stopOptions), 'ContainerStopError');

export const containerRemove = (
	containerId: string,
	removeOptions?: Dockerode.ContainerRemoveOptions
) => catchWithTag(docker.getContainer(containerId).remove(removeOptions), 'ContainerRemoveError');

export const containerInspect = (
	containerId: string,
	inspectOptions?: Dockerode.ContainerInspectOptions
) =>
	catchWithTag(docker.getContainer(containerId).inspect(inspectOptions), 'ContainerInspectError');

export const containerStats = (containerId: string) =>
	catchWithTag(
		docker.getContainer(containerId).stats({ stream: false, 'one-shot': true }),
		'ContainerStatsError'
	);

export const containerWait = (containerId: string, waitOptions?: Dockerode.ContainerWaitOptions) =>
	catchWithTag(docker.getContainer(containerId).wait(waitOptions), 'ContainerWaitError');

export const containerLogs = (
	containerId: string,
	logOptions?: Dockerode.ContainerLogsOptions & { follow: false }
) => catchWithTag(docker.getContainer(containerId).logs(logOptions), 'ContainerLogsError');

export const containerArchive = (containerId: string, path: string) =>
	catchWithTag(docker.getContainer(containerId).getArchive({ path }), 'ContainerArchiveError');

export const imageInspect = (imageId: string) =>
	catchWithTag(docker.getImage(imageId).inspect(), 'ImageInspectError');

export const imageBuild = (...params: Parameters<Dockerode['buildImage']>) =>
	catchWithTag(docker.buildImage(...params), 'ImageBuildError');

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

const gibi = 1024 ** 3;

export const getContainerResourceLimits = (dockerId: string) =>
	containerInspect(dockerId).map((info) => ({
		cpusLimit: info.HostConfig.NanoCpus ? info.HostConfig.NanoCpus * 1e-9 : undefined,
		memoryLimitGiB: info.HostConfig.Memory ? info.HostConfig.Memory / gibi : undefined
	}));

export const runTempContainer = (createOptions: Dockerode.ContainerCreateOptions) =>
	safeTry(async function* () {
		const container = yield* containerCreate(createOptions);
		yield* containerStart(container.id);
		yield* containerWait(container.id);
		yield* validateContainerExit(container.id);

		return ok({
			id: container.id,
			remove: () =>
				containerRemove(container.id).orTee((err) =>
					console.error(`Failed to remove temporary container ${createOptions.name}`, err)
				)
		});
	});

const validateContainerExit = (containerId: string) =>
	safeTry(async function* () {
		const inspect = yield* containerInspect(containerId);
		if (inspect.State.ExitCode !== 0) {
			const logs = await containerLogs(containerId, { stderr: true, follow: false });
			return err(
				tagged('ContainerExitCodeError', {
					exit_code: inspect.State.ExitCode,
					error: inspect.State.Error,
					logs: logs.isOk() ? logs.value.toString() : logs.error
				})
			);
		}
		return ok();
	});
