<script lang="ts">
	import * as Alert from '$lib/components/ui/alert';
	import Button from '$lib/components/ui/button/button.svelte';
	import Workspace from '$lib/components/Workspace.svelte';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import PlusIcon from '@lucide/svelte/icons/plus';

	let { data } = $props();

	const workspacesRes = $derived(data.workspaces);
</script>

<div class="space-y-4">
	<div class="flex gap-4">
		<h1 class="text-3xl">Workspaces</h1>

		{#if workspacesRes.isOk()}
			<Button href="/templates" variant={workspacesRes.value.length === 0 ? 'default' : 'outline'}>
				<PlusIcon /> New Workspace
			</Button>
		{/if}
	</div>

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
</div>
