<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import PlusIcon from '@lucide/svelte/icons/plus';

	let { data } = $props();
</script>

<div class="m-8">
	<div class="flex gap-4">
		<h1 class="text-3xl">Workspaces</h1>

		<Button variant={data.containers.length === 0 ? 'default' : 'outline'} href="/new">
			<PlusIcon /> New Workspace
		</Button>
	</div>

	{#each data.containers as container (container.Id)}
		<div class="m-4">
			<h2 class="text-xl font-bold">{container.Names}</h2>
			<p>Image: {container.Image}</p>
			<p>Status: {container.Status}</p>
			<Button>Open Workspace</Button>
		</div>
	{/each}

	{#if data.containers.length === 0}
		<p>Looks like you don't have any workspaces.</p>
	{/if}
</div>
