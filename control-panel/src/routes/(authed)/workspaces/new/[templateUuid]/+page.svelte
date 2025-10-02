<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Card from '$lib/components/ui/card';
	import Input from '$lib/components/ui/input/input.svelte';
	import { workspaceCreate } from '$lib/fetch';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import SquareDashedMousePointerIcon from '@lucide/svelte/icons/square-dashed-mouse-pointer';
	import { toast } from 'svelte-sonner';

	const { data } = $props();

	let creating = $state(false);

	let name = $state('');

	const create = async () => {
		creating = true;
		await workspaceCreate({
			name: name.length > 0 ? name : data.randomName,
			source: {
				type: 'template',
				templateUuid: data.template.uuid
			}
		})
			.andTee(async (resp) => {
				if (resp.ok) goto('/workspaces');
				else {
					const error = await resp.text();
					console.error('Failed to create workspace: ' + error);
					toast.error('Failed to create workspace', { description: error });
				}
			})
			.orTee((err) => {
				console.error('Failed to create workspace: ' + err.message);
				toast.error('Failed to create workspace', { description: err.message });
			});
		creating = false;
	};
</script>

<h1 class="mb-8 text-3xl">Create a new workspace</h1>

<h2 class="mb-4 text-xl">Template</h2>

<Card.Root class="mb-8 flex max-w-sm flex-row items-center justify-between p-2">
	<div class="pl-2">{data.template.name}</div>
	<Button href="/templates" variant="outline" class="w-fit">
		<SquareDashedMousePointerIcon />
		Change
	</Button>
</Card.Root>

<h2 class="mb-4 text-xl">Name</h2>

<Input bind:value={name} placeholder={data.randomName} class="w-sm" />

<div class="mt-4">
	<Button onclick={create} disabled={creating}>
		{#if creating}
			<LoaderCircleIcon class="animate-spin" />
		{/if}
		Create
	</Button>
</div>
