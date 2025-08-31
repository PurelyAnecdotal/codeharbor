<script>
	import { page } from '$app/state';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import { setName } from '$lib/fetch';

	let name = $state(page.data.user?.name ?? '');
</script>

<h2>Name</h2>

<Input bind:value={name} placeholder="Name" class="my-2 max-w-sm" />

<Button onclick={() => setName(name)}>Change name</Button>
