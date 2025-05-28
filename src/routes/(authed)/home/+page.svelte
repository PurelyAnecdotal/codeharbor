<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import Workspace from '$lib/components/Workspace.svelte';
	import PlusIcon from '@lucide/svelte/icons/plus';

	let { data } = $props();
</script>

<div class="m-8 space-y-4">
	<div class="flex gap-4">
		<h1 class="text-3xl">Workspaces</h1>

		<Button variant={data.workspaces.length === 0 ? 'default' : 'outline'} href="/new">
			<PlusIcon /> New Workspace
		</Button>
	</div>

	{#each data.workspaces as workspace (workspace.uuid)}
		<Workspace {workspace} />
	{/each}

	{#if data.workspaces.length === 0}
		<p>Looks like you don't have any workspaces.</p>
	{/if}
</div>
