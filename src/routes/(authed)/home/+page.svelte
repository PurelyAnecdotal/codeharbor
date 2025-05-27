<script lang="ts">
	import Badge from '$lib/components/ui/badge/badge.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Card from '$lib/components/ui/card';
	import CircleDashedIcon from '@lucide/svelte/icons/circle-dashed';
	import GithubIcon from '@lucide/svelte/icons/github';
	import MonitorXIcon from '@lucide/svelte/icons/monitor-x';
	import OctagonIcon from '@lucide/svelte/icons/octagon';
	import OctagonMinusIcon from '@lucide/svelte/icons/octagon-minus';
	import OctagonXIcon from '@lucide/svelte/icons/octagon-x';
	import PauseIcon from '@lucide/svelte/icons/pause';
	import PlayIcon from '@lucide/svelte/icons/play';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import RotateCCWIcon from '@lucide/svelte/icons/rotate-ccw';
	import ScreenShareIcon from '@lucide/svelte/icons/screen-share';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';

	let { data } = $props();

	async function startWorkspace(uuid: string) {
		await fetch(`/workspace/${uuid}/start`, { method: 'POST' });
	}

	async function stopWorkspace(uuid: string) {
		await fetch(`/workspace/${uuid}/stop`, { method: 'POST' });
	}

	async function deleteWorkspace(uuid: string) {
		await fetch(`/workspace/${uuid}`, { method: 'DELETE' });
	}
</script>

<div class="m-8 space-y-4">
	<div class="flex gap-4">
		<h1 class="text-3xl">Workspaces</h1>

		<Button variant={data.workspaces.length === 0 ? 'default' : 'outline'} href="/new">
			<PlusIcon /> New Workspace
		</Button>
	</div>

	{#each data.workspaces as { name, repoURL, uuid, url, state } (uuid)}
		<Card.Root>
			<Card.Header>
				<Card.Title>
					{name}
					<Badge variant="outline">
						{#if state === 'created'}
							<CircleDashedIcon /> Created
						{:else if state === 'running'}
							<PlayIcon /> Running
						{:else if state === 'restarting'}
							<RotateCCWIcon /> Restarting
						{:else if state === 'exited'}
							<OctagonIcon class="w-5" /> Stopped
						{:else if state === 'paused'}
							<PauseIcon /> Paused
						{:else if state === 'dead'}
							<OctagonXIcon /> Dead
						{:else if state === 'removing'}
							<OctagonMinusIcon /> Removing
						{:else}
							<TriangleAlertIcon /> Unknown State ({state})
						{/if}
					</Badge>
				</Card.Title>
				<Card.Description class="flex items-center gap-1">
					<GithubIcon class="w-4" />
					{repoURL}
				</Card.Description>
			</Card.Header>
			<Card.Footer class="flex gap-2">
				{#if url}
					<Button href={url}>
						<ScreenShareIcon />
						Open
					</Button>
				{/if}
				{#if state === 'exited' || state === 'created'}
					<Button onclick={() => startWorkspace(uuid)}>
						<PlayIcon />
						Start
					</Button>
				{:else if state === 'running'}
					<Button onclick={() => stopWorkspace(uuid)} variant="outline">
						<MonitorXIcon />
						Stop
					</Button>
				{/if}

				{#if state !== 'removing' && state !== 'running'}
					<Button onclick={() => deleteWorkspace(uuid)} variant="outline">
						<OctagonMinusIcon />
						Delete
					</Button>
				{/if}
			</Card.Footer>
		</Card.Root>
	{/each}

	{#if data.workspaces.length === 0}
		<p>Looks like you don't have any workspaces.</p>
	{/if}
</div>
