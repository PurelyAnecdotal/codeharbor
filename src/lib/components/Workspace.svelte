<script lang="ts">
	import Badge from '$lib/components/ui/badge/badge.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Card from '$lib/components/ui/card';
	import CircleDashedIcon from '@lucide/svelte/icons/circle-dashed';
	import GithubIcon from '@lucide/svelte/icons/github';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import MonitorXIcon from '@lucide/svelte/icons/monitor-x';
	import OctagonIcon from '@lucide/svelte/icons/octagon';
	import OctagonMinusIcon from '@lucide/svelte/icons/octagon-minus';
	import OctagonXIcon from '@lucide/svelte/icons/octagon-x';
	import PauseIcon from '@lucide/svelte/icons/pause';
	import PlayIcon from '@lucide/svelte/icons/play';
	import RotateCCWIcon from '@lucide/svelte/icons/rotate-ccw';
	import ScreenShareIcon from '@lucide/svelte/icons/screen-share';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import type { WorkspaceContainer } from '../../routes/(authed)/home/+page.server';

	interface Props {
		workspace: WorkspaceContainer;
	}

	const { workspace }: Props = $props();

	let starting = $state(false);
	let stopping = $state(false);
	let deleting = $state(false);

	async function startWorkspace(uuid: string) {
		starting = true;
		await fetch(`/workspace/${uuid}/start`, { method: 'POST' });
		starting = false;
		location.reload();
	}

	async function stopWorkspace(uuid: string) {
		stopping = true;
		await fetch(`/workspace/${uuid}/stop`, { method: 'POST' });
		stopping = false;
		location.reload();
	}

	async function deleteWorkspace(uuid: string) {
		deleting = true;
		await fetch(`/workspace/${uuid}`, { method: 'DELETE' });
		deleting = false;
		location.reload();
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>
			{workspace.name}
			<Badge variant="outline">
				{#if workspace.state === 'created'}
					<CircleDashedIcon /> Created
				{:else if workspace.state === 'running'}
					<PlayIcon /> Running
				{:else if workspace.state === 'restarting'}
					<RotateCCWIcon /> Restarting
				{:else if workspace.state === 'exited'}
					<OctagonIcon class="w-5" /> Stopped
				{:else if workspace.state === 'paused'}
					<PauseIcon /> Paused
				{:else if workspace.state === 'dead'}
					<OctagonXIcon /> Dead
				{:else if workspace.state === 'removing'}
					<OctagonMinusIcon /> Removing <LoaderCircleIcon class="animate-spin" />
				{:else}
					<TriangleAlertIcon /> Unknown workspace.state ({workspace.state})
				{/if}
			</Badge>
		</Card.Title>
		<Card.Description>
			<a href={workspace.repoURL} target="_blank" class="flex items-center gap-1">
				<GithubIcon class="w-4" />
				{new URL(workspace.repoURL).pathname.replace(/^\//, '').replace(/\.git$/, '')}
			</a>
		</Card.Description>
	</Card.Header>
	<Card.Footer class="flex gap-2">
		{#if workspace.url}
			<Button href={workspace.url} target="_blank">
				<ScreenShareIcon />
				Open
			</Button>
		{/if}
		{#if workspace.state === 'exited' || workspace.state === 'created'}
			<Button onclick={() => startWorkspace(workspace.uuid)} variant="outline" disabled={starting}>
				<PlayIcon />
				Start
				{#if starting}
					<LoaderCircleIcon class="animate-spin" />
				{/if}
			</Button>
		{:else if workspace.state === 'running'}
			<Button onclick={() => stopWorkspace(workspace.uuid)} variant="outline" disabled={stopping}>
				<MonitorXIcon />
				Stop
				{#if stopping}
					<LoaderCircleIcon class="animate-spin" />
				{/if}
			</Button>
		{/if}

		{#if workspace.state !== 'removing' && workspace.state !== 'running'}
			<Button onclick={() => deleteWorkspace(workspace.uuid)} variant="outline" disabled={deleting}>
				<OctagonMinusIcon />
				Delete
				{#if deleting}
					<LoaderCircleIcon class="animate-spin" />
				{/if}
			</Button>
		{/if}
	</Card.Footer>
</Card.Root>
