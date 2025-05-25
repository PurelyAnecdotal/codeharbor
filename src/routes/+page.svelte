<script lang="ts">
	import { page } from '$app/state';
	import { signIn, signOut } from '@auth/sveltekit/client';
	let { data } = $props();
</script>

<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>

<div class="m-4">
	{#if page.data.session}
		<span>Hello {page.data.session.user?.name}</span>
		<button onclick={() => signOut()} class="cursor-pointer rounded bg-slate-700 p-2 text-white">
			Sign out
		</button>
	{:else}
		<span>You are not signed in</span>
		<button
			onclick={() => signIn('github')}
			class="cursor-pointer rounded bg-slate-700 p-2 text-white"
		>
			Sign in
		</button>
	{/if}

	<div>
		<a href="/instance" class="rounded bg-green-700 p-2 text-white">Open instance</a>
		<a href="/new" class="rounded bg-green-700 p-2 text-white">Create instance</a>
	</div>
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
