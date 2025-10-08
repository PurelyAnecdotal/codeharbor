<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Command from '$lib/components/ui/command';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Popover from '$lib/components/ui/popover';
	import { JtoR } from '$lib/result.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import GithubIcon from '$lib/components/GitHubIcon.svelte';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { createTemplate } from '../templates.remote.js';

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
	let useDevcontainerConfig = $state(false);

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

		JtoR(
			await createTemplate({
				name,
				description: description.length > 0 ? description : undefined,
				ghRepoOwner: repo.owner.login,
				ghRepoName: repo.name,
				devcontainer: useDevcontainerConfig
			})
		).match(
			() => goto('/templates'),
			(err) => toast.error('Failed to create template', { description: err.message })
		);

		creating = false;
	}
</script>

<h1 class="mb-8 text-3xl">Create a new template</h1>

<h2 class="mb-4 text-lg">Select from your repositories</h2>

{#if reposResult.isOk()}
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
					<GithubIcon class="fill-white" />
					{selectedRepoName ?? 'Select a repo...'}
					<ChevronsUpDownIcon class="opacity-50" />
				</Button>
			{/snippet}
		</Popover.Trigger>

		<Popover.Content class="w-xs p-0">
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
{:else}
	<Alert.Root variant="destructive">
		<CircleAlertIcon class="size-4" />
		<Alert.Title>Failed to load repositories</Alert.Title>
		<Alert.Description>
			{reposResult.error.message}
		</Alert.Description>
	</Alert.Root>
{/if}

<h2 class="mt-8 mb-4 text-lg">Name</h2>

<Input bind:value={name} class="w-sm" />

<h2 class="mt-8 mb-4 text-lg">Description</h2>

<Input bind:value={description} class="w-sm" />

<div class="mt-8 flex items-start gap-3">
	<Checkbox id="devcontainer" bind:checked={useDevcontainerConfig} />
	<div class="grid gap-2">
		<Label for="devcontainer">Use devcontainer</Label>
		<p class="text-muted-foreground text-sm">
			The repository must contain a devcontainer configuration file.
		</p>
	</div>
</div>

<div class="mt-8">
	<Button onclick={create} disabled={creating}>
		Create
		{#if creating}
			<LoaderCircleIcon class="animate-spin" />
		{/if}
	</Button>
</div>
