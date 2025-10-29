<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import { setName } from '$lib/fetch.js';

	const { data } = $props();

	let name = $state(data.ghName ?? '');
</script>

<h1 class="text-2xl font-bold">Welcome to CodeHarbor</h1>

<p>Set a name to continue. You can change this at any time.</p>

<Input bind:value={name} placeholder="Name" class="my-2 w-full max-w-sm" />

<Button onclick={() => setName(name)}>Next</Button>
