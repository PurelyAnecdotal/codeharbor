<script>
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Card from '$lib/components/ui/card';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SquareMousePointerIcon from '@lucide/svelte/icons/square-mouse-pointer';

	let { data } = $props();
</script>

<div class="flex gap-4">
	<h1 class="mb-4 text-3xl">Templates</h1>

	<Button href="/templates/new" variant="outline" class="mb-4">
		<PlusIcon /> New Template
	</Button>
</div>

<p class="opacity-70">Workspaces are created from templates.</p>

<div class="mt-4 grid gap-4 grid-cols-3">
	{#each data.templates as template (template.uuid)}
		<Card.Root>
			<Card.Header>
				<Card.Title>{template.name}</Card.Title>
				<Card.Description>{template.description}</Card.Description>
				<div class="flex items-center gap-2">
					<img
						src="https://avatars.githubusercontent.com/u/{template.owner.ghId}?s=32"
						alt={template.owner.name}
						class="h-6 w-6 rounded-full"
					/>
					{template.owner.name}
				</div>
				<a href="https://github.com/{template.ghRepoOwner}/{template.ghRepoName}" class="text-sm text-gray-400">
					{template.ghRepoOwner}/{template.ghRepoName}
				</a>
			</Card.Header>
			<Card.Footer>
				<Button href="/workspaces/new/{template.uuid}">
					<SquareMousePointerIcon />
					Use template</Button
				>
			</Card.Footer>
		</Card.Root>
	{/each}
</div>

{#if data.templates.length === 0}
	<p class="text-gray-500">No templates found.</p>
{/if}
