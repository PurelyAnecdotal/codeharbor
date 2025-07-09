<script lang="ts">
	import { page } from '$app/state';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import Badge from '$lib/components/ui/badge/badge.svelte';
	import Button, { buttonVariants } from '$lib/components/ui/button/button.svelte';
	import * as Card from '$lib/components/ui/card';
	import { safeFetch } from '$lib/fetch';
	import type { WorkspaceContainerInfo } from '$lib/types';
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
	import { toast } from 'svelte-sonner';

	interface Props {
		workspace: WorkspaceContainerInfo;
	}

	const { workspace }: Props = $props();

	let starting = $state(false);
	let stopping = $state(false);
	let deleting = $state(false);

	async function startWorkspace(uuid: string) {
		starting = true;

		const res = await safeFetch(`/workspace/${uuid}/start`, { method: 'POST' });

		starting = false;

		res.match(
			async (resp) => {
				if (resp.ok) location.reload();
				else toast.error('Failed to start workspace', { description: await resp.text() });
			},
			(err) => toast.error('Failed to start workspace', { description: err.message })
		);
	}

	async function stopWorkspace(uuid: string) {
		stopping = true;

		const res = await safeFetch(`/workspace/${uuid}/stop`, { method: 'POST' });

		stopping = false;

		res.match(
			async (resp) => {
				if (resp.ok) location.reload();
				else toast.error('Failed to stop workspace', { description: await resp.text() });
			},
			(err) => toast.error('Failed to stop workspace', { description: err.message })
		);
	}

	async function deleteWorkspace(uuid: string) {
		deleting = true;

		const res = await safeFetch(`/workspace/${uuid}`, { method: 'DELETE' });

		deleting = false;

		res.match(
			async (resp) => {
				if (resp.ok) location.reload();
				else toast.error('Failed to delete workspace', { description: await resp.text() });
			},
			(err) => toast.error('Failed to delete workspace', { description: err.message })
		);
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
		{#if workspace.ownerId !== page.data.session?.id}
			<Badge variant="secondary">
				{#if workspace.ownerLogin}
					Shared with you by {workspace.ownerName} ({workspace.ownerLogin})
				{:else if workspace.ownerName}
					Shared with you by {workspace.ownerName}
				{:else}
					Shared with you
				{/if}
			</Badge>
		{/if}
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
			<AlertDialog.Root>
				<AlertDialog.Trigger class={buttonVariants({ variant: 'outline' })} disabled={deleting}>
					<OctagonMinusIcon />
					Delete
					{#if deleting}
						<LoaderCircleIcon class="animate-spin" />
					{/if}
				</AlertDialog.Trigger>
				<AlertDialog.Content>
					<AlertDialog.Header>
						<AlertDialog.Title>Are you sure?</AlertDialog.Title>
						<AlertDialog.Description>
							This action cannot be undone. This will permanently delete this workspace.
						</AlertDialog.Description>
					</AlertDialog.Header>
					<AlertDialog.Footer>
						<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
						<AlertDialog.Action onclick={() => deleteWorkspace(workspace.uuid)}>
							Continue
						</AlertDialog.Action>
					</AlertDialog.Footer>
				</AlertDialog.Content>
			</AlertDialog.Root>
		{/if}
	</Card.Footer>
</Card.Root>
