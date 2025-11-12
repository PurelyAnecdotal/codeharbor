<script lang="ts">
	import * as Alert from '$lib/components/ui/alert';
	import Button from '$lib/components/ui/button/button.svelte';
	import type { InferOk } from '$lib/result';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Workspace from './Workspace.svelte';
	import { getWorkspaces } from './workspaces.remote';

	const workspacesListQuery = getWorkspaces();

	let workspacesList: InferOk<Awaited<ReturnType<typeof getWorkspaces>>> | undefined = $state();

	workspacesListQuery.then((result) => {
		if (result.isOk()) workspacesList = result.value;
	});

	const buttonVariant = $derived(
		workspacesList ? (workspacesList.length === 0 ? 'default' : 'outline') : 'outline'
	);
</script>

<div class="space-y-4">
	<div class="flex gap-4">
		<h1 class="text-3xl">Workspaces</h1>

		<Button href="/templates" variant={buttonVariant}>
			<PlusIcon /> New Workspace
		</Button>
	</div>

	{#await workspacesListQuery}
		<p>Loading workspaces...</p>
	{:then workspacesResult}
		{#if workspacesResult.isOk()}
			{#each workspacesResult.value as workspace (workspace.uuid)}
				<Workspace {workspace} />
			{:else}
				<p class="opacity-70">Looks like you don't have any workspaces.</p>
			{/each}
		{:else}
			<Alert.Root variant="destructive">
				<CircleAlertIcon class="size-4" />
				<Alert.Title>Failed to show workspaces</Alert.Title>
				<Alert.Description>
					{workspacesResult.error.message}
				</Alert.Description>
			</Alert.Root>
		{/if}
	{/await}
</div>
