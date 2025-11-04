<script lang="ts">
	import { page } from '$app/state';
	import GithubIcon from '$lib/components/GitHubIcon.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Badge } from '$lib/components/ui/badge';
	import * as ButtonGroup from '$lib/components/ui/button-group';
	import Button, { buttonVariants } from '$lib/components/ui/button/button.svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Sheet from '$lib/components/ui/sheet';
	import type { ErrorTypes, Tagged } from '$lib/error.js';
	import type { Uuid } from '$lib/types.js';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import EthernetPortIcon from '@lucide/svelte/icons/ethernet-port';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import OctagonMinusIcon from '@lucide/svelte/icons/octagon-minus';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SquareMousePointerIcon from '@lucide/svelte/icons/square-mouse-pointer';
	import { ResultAsync } from 'neverthrow';
	import { toast } from 'svelte-sonner';
	import { deleteTemplate as remoteDeleteTemplate } from './templates.remote.js';

	let { data } = $props();

	let deleteDialogOpen = $state(false);
	let deleting = $state(false);

	export async function deleteTemplate(uuid: Uuid) {
		deleting = true;

		(await remoteDeleteTemplate(uuid)).match(() => {
			toast.success('Template deleted');
			location.reload(); // TODO: use query function invalidation instead
		}, handleWithToast('Failed to delete template'));

		deleting = false;
		deleteDialogOpen = false;
	}

	const handleWithToast = (errMsg: string) => (err: Tagged<ErrorTypes>) => {
		toast.error(errMsg, { description: err.message });
		console.error(err);
	};

	const copyTemplateLink = (templateUuid: Uuid) =>
		ResultAsync.fromPromise(
			navigator.clipboard.writeText(`${location.origin}/workspaces/new/${templateUuid}`),
			(e) => e as DOMException
		).match(
			() => toast.success('Copied template link to clipboard'),
			(err) =>
				toast.error('Failed to copy template link to clipboard', {
					description: err?.message ?? err.toString()
				})
		);
</script>

<div class="flex gap-4">
	<h1 class="mb-4 text-3xl">Templates</h1>

	<Button href="/templates/new" variant="outline" class="mb-4">
		<PlusIcon /> New Template
	</Button>
</div>

<p class="opacity-70">Workspaces are created from templates.</p>

<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
	{#each data.templates as template (template.uuid)}
		<Card.Root>
			<Card.Header>
				<Card.Title class="mb-2 text-lg">{template.name}</Card.Title>
				<Card.Description>
					<div class="flex items-center gap-2">
						<img
							src="https://avatars.githubusercontent.com/u/{template.owner.ghId}?s=32"
							alt={template.owner.name}
							class="h-6 w-6 rounded-full"
						/>
						{template.owner.name}
					</div>
				</Card.Description>
			</Card.Header>

			<Card.Content>
				{#if template.description !== null}
					<p class="wrap-break-word text-sm text-gray-300">{template.description}</p>
				{/if}
			</Card.Content>

			<Card.Footer class="mt-auto flex flex-wrap gap-1">
				<ButtonGroup.Root>
					<Button href="/workspaces/new/{template.uuid}" class="opacity-100">
						<SquareMousePointerIcon />
						Use template
					</Button>
					<Button variant="outline" onclick={() => copyTemplateLink(template.uuid)}>
						<CopyIcon />
						Share
					</Button>
				</ButtonGroup.Root>
				{#if page.data.user?.uuid === template.owner.uuid}
					{@render deleteButton(template.uuid)}
				{/if}
				{#if template.portLabelsJson}
					<Sheet.Root>
						<Sheet.Trigger>
							<Button variant="outline">
								<EthernetPortIcon /> Ports
								<Badge
									class="h-5 min-w-5 rounded-full px-1 font-mono tabular-nums"
									variant="outline"
								>
									{Object.keys(template.portLabelsJson).length}
								</Badge>
							</Button>
						</Sheet.Trigger>
						<Sheet.Content>
							<Sheet.Header>
								<Sheet.Title>Labeled Ports</Sheet.Title>

								{#each Object.entries(template.portLabelsJson) as [port, label]}
									<div class="flex items-center justify-between gap-4 border-b py-2">
										<span>{label}</span>
										<span class="font-mono text-sm text-gray-400">{port}</span>
									</div>
								{/each}
							</Sheet.Header>
						</Sheet.Content>
					</Sheet.Root>
				{/if}
				<Button
					href="https://github.com/{template.ghRepoOwner}/{template.ghRepoName}"
					target="_blank"
					variant="outline"
				>
					<GithubIcon class="w-4 fill-white" />
					Source
				</Button>
			</Card.Footer>
		</Card.Root>
	{/each}
</div>

{#if data.templates.length === 0}
	<p class="text-gray-500">No templates found.</p>
{/if}

{#snippet deleteButton(templateUuid: Uuid)}
	<AlertDialog.Root bind:open={deleteDialogOpen}>
		<AlertDialog.Trigger class={buttonVariants({ variant: 'outline' })}>
			<OctagonMinusIcon />
			Delete
		</AlertDialog.Trigger>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>Are you sure?</AlertDialog.Title>
				<AlertDialog.Description>
					This action cannot be undone. This will permanently delete this template.
				</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel disabled={deleting}>Cancel</AlertDialog.Cancel>
				<AlertDialog.Action onclick={() => deleteTemplate(templateUuid)} disabled={deleting}>
					Continue
					{#if deleting}
						<LoaderCircleIcon class="animate-spin" />
					{/if}
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
{/snippet}
