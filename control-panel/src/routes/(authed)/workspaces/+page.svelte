<script lang="ts">
	import * as Alert from '$lib/components/ui/alert';
	import Button from '$lib/components/ui/button/button.svelte';
	import { JtoR } from '$lib/result';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Workspace from './Workspace.svelte';
	import { getWorkspaces } from './workspaces.remote';

	type WorkspacesRes = NonNullable<typeof current>;

	const workspacesListQuery = getWorkspaces();

	const current = $derived(
		workspacesListQuery.ready ? JtoR(workspacesListQuery.current) : undefined
	);
</script>

<div class="space-y-4">
	<div class="flex gap-4">
		<h1 class="text-3xl">Workspaces</h1>

		{#if workspacesListQuery.ready}
			{@render newWorkspace(JtoR(workspacesListQuery.current))}
		{:else}
			{@render newWorkspaceButton()}
		{/if}
	</div>

	{#if workspacesListQuery.ready}
		{@render workspacesList(JtoR(workspacesListQuery.current))}
	{:else}
		<p class="text-gray-500">Loading workspaces...</p>
	{/if}
</div>

{#snippet newWorkspace(workspacesRes: WorkspacesRes)}
	{#if workspacesRes.isOk()}
		{@render newWorkspaceButton(workspacesRes.value.length === 0)}
	{/if}
{/snippet}

{#snippet newWorkspaceButton(highlight = false)}
	<Button href="/templates" variant={highlight ? 'default' : 'outline'}>
		<PlusIcon /> New Workspace
	</Button>
{/snippet}

{#snippet workspacesList(workspacesRes: WorkspacesRes)}
	{#if workspacesRes.isOk()}
		{#each workspacesRes.value as workspace (workspace.uuid)}
			<Workspace {workspace} />
		{:else}
			<p class="opacity-70">Looks like you don't have any workspaces.</p>
		{/each}
	{:else}
		<Alert.Root variant="destructive">
			<CircleAlertIcon class="size-4" />
			<Alert.Title>Failed to show workspaces</Alert.Title>
			<Alert.Description>
				{workspacesRes.error.message}
			</Alert.Description>
		</Alert.Root>
	{/if}
{/snippet}
