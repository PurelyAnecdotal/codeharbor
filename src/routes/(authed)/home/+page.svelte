<script lang="ts">
	let { data } = $props();
</script>

<div>
	<a href="/instance" class="rounded bg-green-700 p-2 text-white">Open instance</a>
	<a href="/new" class="rounded bg-green-700 p-2 text-white">Create instance</a>
</div>

{#each data.containers as container (container.Id)}
	<div class="m-4">
		<h2 class="text-xl font-bold">{container.Names}</h2>
		<p>Image: {container.Image}</p>
		<p>Status: {container.Status}</p>
	</div>
{/each}

{#each data.repos as repo (repo.id)}
	<div class="m-4">
		<h2 class="text-xl font-bold">{repo.name}</h2>
		<p>Description: {repo.description}</p>
		<p>{repo.private ? 'Private' : 'Public'}</p>
	</div>
{/each}
