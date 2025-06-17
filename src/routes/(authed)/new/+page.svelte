<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as Alert from '$lib/components/ui/alert';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Command from '$lib/components/ui/command';
	import * as Popover from '$lib/components/ui/popover';
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

		const cloneURL = reposResult.value.find((r) => r.id === selectedRepoID)?.clone_url;

		if (!selectedRepoID || !cloneURL || creating) return;

		creating = true;

		const res = await fetch('/new', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ cloneURL })
		});

		creating = false;

		if (res.ok) goto('/home');
	}
</script>

<h1 class="mb-4 text-3xl">Create a new workspace</h1>

<h2 class="mb-4 text-xl">Template</h2>

<p class="mb-4">Select from your repositories</p>

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

	<div class="mt-4">
		<Button onclick={create} disabled={creating}>
			{#if creating}
				<LoaderCircleIcon class="animate-spin" />
			{/if}
			Create
		</Button>
	</div>
{/if}
