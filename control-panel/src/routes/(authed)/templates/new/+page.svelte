<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as Alert from '$lib/components/ui/alert';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Command from '$lib/components/ui/command';
	import { Input } from '$lib/components/ui/input';
	import * as Popover from '$lib/components/ui/popover';
	import { safeFetch } from '$lib/fetch';
	import type { TemplateCreateOptions } from '$lib/server/templates.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import GithubIcon from '@lucide/svelte/icons/github';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';

	const { data } = $props();

	const reposResult = $derived(data.repos);

	let repoPickerOpen = $state(false);
	let triggerRef = $state<HTMLButtonElement>(null!);
	let creating = $state(false);

	let selectedRepoID: number | undefined = $state();
	let selectedRepoName = $derived(
		reposResult.isOk() ? reposResult.value.find((r) => r.id === selectedRepoID)?.name : undefined
	);

	let name = $state('');
	let description = $state('');

	function closeAndFocusTrigger() {
		repoPickerOpen = false;
		tick().then(() => {
			triggerRef.focus();
		});
	}

	async function create() {
		if (reposResult.isErr()) {
			toast.error('Failed to create workspace', {
				description: reposResult.error.message
			});
			return;
		}

		if (name.length === 0) {
			toast.error('Name is required');
			return;
		}

		if (name.length > 50) {
			toast.error('Name is too long', { description: 'Name must be less than 50 characters' });
			return;
		}

		if (description.length > 500) {
			toast.error('Description is too long', {
				description: 'Description must be less than 500 characters'
			});
			return;
		}

		const repo = reposResult.value.find((r) => r.id === selectedRepoID);
		if (!repo) return;

		creating = true;
		await templateCreate({
			name,
			description: description.length > 0 ? description : undefined,
			ghRepoOwner: repo.owner.login,
			ghRepoName: repo.name
		})
			.andTee((resp) => {
				if (resp.ok) goto('/templates');
				else toast.error('Failed to create template', { description: resp.statusText });
			})
			.orTee((err) => toast.error('Failed to create template', { description: err.message }));
		creating = false;
	}

	const templateCreate = (options: TemplateCreateOptions) =>
		safeFetch('/api/template', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(options)
		});
</script>

<h1 class="mb-8 text-3xl">Create a new template</h1>

<h2 class="mb-4 text-xl">Select from your repositories</h2>

{#if reposResult.isErr()}
	<Alert.Root variant="destructive">
		<CircleAlertIcon class="size-4" />
		<Alert.Title>Failed to load repositories</Alert.Title>
		<Alert.Description>
			{reposResult.error.message}
		</Alert.Description>
	</Alert.Root>
{:else}
	<Popover.Root bind:open={repoPickerOpen}>
		<Popover.Trigger bind:ref={triggerRef}>
			{#snippet child({ props })}
				<Button
					variant="outline"
					class="w-[200px] justify-between"
					{...props}
					role="combobox"
					aria-expanded={repoPickerOpen}
				>
					<GithubIcon />
					{selectedRepoName ?? 'Select a repo...'}
					<ChevronsUpDownIcon class="opacity-50" />
				</Button>
			{/snippet}
		</Popover.Trigger>

		<Popover.Content class="w-[200px] p-0">
			<Command.Root>
				<Command.Input placeholder="Search repos..." />
				<Command.List>
					<Command.Empty>No repo found.</Command.Empty>
					<Command.Group value="frameworks">
						{#each reposResult.value as { name, id, owner, full_name } (id)}
							<Command.Item
								value={full_name}
								onSelect={() => {
									selectedRepoID = id;
									closeAndFocusTrigger();
								}}
							>
								<CheckIcon class={selectedRepoID === id ? '' : 'text-transparent'} />
								{#if owner.id === page.data.session?.id}
									{name}
								{:else}
									{owner.login}/{name}
								{/if}
							</Command.Item>
						{/each}
					</Command.Group>
				</Command.List>
			</Command.Root>
		</Popover.Content>
	</Popover.Root>
{/if}

<h2 class="mt-8 mb-4 text-xl">Name</h2>

<Input bind:value={name} class="w-sm" />

<h2 class="mt-8 mb-4 text-xl">Description</h2>

<Input bind:value={description} class="w-sm" />

<div class="mt-8">
	<Button onclick={create} disabled={creating}>
		Create
		{#if creating}
			<LoaderCircleIcon class="animate-spin" />
		{/if}
	</Button>
</div>
