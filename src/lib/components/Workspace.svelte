<script lang="ts">
	import { page } from '$app/state';
	import {
		workspaceDelete,
		workspaceShare,
		workspaceStart,
		workspaceStop,
		workspaceUnshare
	} from '$lib/api';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import Badge from '$lib/components/ui/badge/badge.svelte';
	import Button, { buttonVariants } from '$lib/components/ui/button/button.svelte';
	import * as Card from '$lib/components/ui/card';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import Input from '$lib/components/ui/input/input.svelte';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import type { GitHubUserInfo, Uuid, WorkspaceContainerInfo } from '$lib/types';
	import CircleDashedIcon from '@lucide/svelte/icons/circle-dashed';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import GithubIcon from '@lucide/svelte/icons/github';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import MonitorXIcon from '@lucide/svelte/icons/monitor-x';
	import OctagonIcon from '@lucide/svelte/icons/octagon';
	import OctagonMinusIcon from '@lucide/svelte/icons/octagon-minus';
	import OctagonXIcon from '@lucide/svelte/icons/octagon-x';
	import PauseIcon from '@lucide/svelte/icons/pause';
	import PlayIcon from '@lucide/svelte/icons/play';
	import RotateCCWIcon from '@lucide/svelte/icons/rotate-ccw';
	import ScreenShareIcon from '@lucide/svelte/icons/screen-share';
	import Share2Icon from '@lucide/svelte/icons/share-2';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import UserMinusIcon from '@lucide/svelte/icons/user-minus';
	import UserPlusIcon from '@lucide/svelte/icons/user-plus';
	import UsersIcon from '@lucide/svelte/icons/users';
	import type { Result } from 'neverthrow';
	import { toast } from 'svelte-sonner';

	interface Props {
		workspace: WorkspaceContainerInfo;
	}

	const { workspace }: Props = $props();

	let starting = $state(false);
	let stopping = $state(false);
	let deleting = $state(false);

	async function startWorkspace() {
		starting = true;
		const res = await workspaceStart(workspace.uuid);
		starting = false;

		res.map(reloadIfOk);
		handleWithToast(res, 'Failed to start workspace');
	}

	async function stopWorkspace() {
		stopping = true;
		const res = await workspaceStop(workspace.uuid);
		stopping = false;

		res.map(reloadIfOk);
		handleWithToast(res, 'Failed to stop workspace');
	}

	async function deleteWorkspace() {
		deleting = true;
		const res = await workspaceDelete(workspace.uuid);
		deleting = false;

		res.map(reloadIfOk);
		handleWithToast(res, 'Failed to delete workspace');
	}

	async function addSharedUser(uuid: Uuid) {
		const res = await workspaceShare(workspace.uuid, uuid);

		handleWithToast(res, 'Failed to share workspace with user', 'Workspace shared with user');
	}

	async function removeSharedUser(uuid: Uuid) {
		const res = await workspaceUnshare(workspace.uuid, uuid);

		handleWithToast(
			res,
			'Failed to remove workspace access for user',
			'Workspace access removed for user'
		);
	}

	const reloadIfOk = (resp: Response) => {
		if (resp.ok) location.reload();
	};

	const handleWithToast = (
		result: Result<Response, DOMException | TypeError>,
		errorMessage: string,
		successMessage?: string
	) =>
		result.match(
			async (resp) => {
				if (resp.ok && successMessage) toast.success(successMessage);
				else toast.error(errorMessage, { description: await resp.text() });
			},
			(err) => toast.error(errorMessage, { description: err.message })
		);

	const yourID = $derived(page.data.session?.id);

	let addSharedUserPopoverOpen = $state(false);

	let addSharedUserInput = $state('');
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>
			{workspace.name}
			<Badge variant="outline">
				{#if workspace.state === 'created'}
					<CircleDashedIcon /> Created
				{:else if workspace.state === 'running'}
					<PlayIcon /> Running
				{:else if workspace.state === 'restarting'}
					<RotateCCWIcon /> Restarting
				{:else if workspace.state === 'exited'}
					<OctagonIcon class="w-5" /> Stopped
				{:else if workspace.state === 'paused'}
					<PauseIcon /> Paused
				{:else if workspace.state === 'dead'}
					<OctagonXIcon /> Dead
				{:else if workspace.state === 'removing'}
					<OctagonMinusIcon /> Removing <LoaderCircleIcon class="animate-spin" />
				{:else}
					<TriangleAlertIcon /> Unknown workspace.state ({workspace.state})
				{/if}
			</Badge>
		</Card.Title>
		<Card.Description>
			<a href={workspace.repoURL} target="_blank" class="flex items-center gap-1">
				<GithubIcon class="w-4" />
				{new URL(workspace.repoURL).pathname.replace(/^\//, '').replace(/\.git$/, '')}
			</a>
		</Card.Description>
		<!-- {#if workspace.ownerId !== page.data.session?.id && workspace.ownerInfo}
			<Badge variant="default">
				Owned by {@render username(workspace.ownerInfo)}
			</Badge>
		{/if} -->
	</Card.Header>

	<Card.Footer class="flex gap-2">
		{#if workspace.url}
			<Button href={workspace.url} target="_blank">
				<ScreenShareIcon />
				Open
			</Button>
		{/if}
		{#if workspace.state === 'exited' || workspace.state === 'created'}
			<Button onclick={() => startWorkspace()} variant="outline" disabled={starting}>
				<PlayIcon />
				Start
				{#if starting}
					<LoaderCircleIcon class="animate-spin" />
				{/if}
			</Button>
		{:else if workspace.state === 'running'}
			<Button onclick={() => stopWorkspace()} variant="outline" disabled={stopping}>
				<MonitorXIcon />
				Stop
				{#if stopping}
					<LoaderCircleIcon class="animate-spin" />
				{/if}
			</Button>
		{/if}

		{#if workspace.state !== 'removing' && workspace.state !== 'running'}
			<AlertDialog.Root>
				<AlertDialog.Trigger
					class={buttonVariants({ variant: 'outline' })}
					disabled={deleting || yourID !== workspace.ownerUuid}
				>
					<OctagonMinusIcon />
					Delete
					{#if deleting}
						<LoaderCircleIcon class="animate-spin" />
					{/if}
				</AlertDialog.Trigger>
				<AlertDialog.Content>
					<AlertDialog.Header>
						<AlertDialog.Title>Are you sure?</AlertDialog.Title>
						<AlertDialog.Description>
							This action cannot be undone. This will permanently delete this workspace.
						</AlertDialog.Description>
					</AlertDialog.Header>
					<AlertDialog.Footer>
						<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
						<AlertDialog.Action onclick={() => deleteWorkspace()}>Continue</AlertDialog.Action>
					</AlertDialog.Footer>
				</AlertDialog.Content>
			</AlertDialog.Root>
		{/if}

		<Sheet.Root>
			<Sheet.Trigger class={buttonVariants({ variant: 'outline' })}>
				<Share2Icon />
				Share
				{#if workspace.sharedUserUuids.length > 0}
					<Badge class="h-5 min-w-5 rounded-full px-1 tabular-nums" variant="outline">
						{workspace.sharedUserUuids.length}
					</Badge>
				{/if}
			</Sheet.Trigger>
			<Sheet.Content side="right">
				<Sheet.Header>
					<Sheet.Title>Share workspace</Sheet.Title>
					<Sheet.Description>Manage which users can access this workspace.</Sheet.Description>
				</Sheet.Header>

				<div class="px-4">
					<div class="text-sm font-medium">Owner</div>

					{#if workspace.ownerInfo}
						{@render userCard(workspace.ownerInfo, workspace.ownerUuid)}
					{/if}

					<div class="mt-4 text-sm font-medium">Shared with</div>

					{#each workspace.sharedUserUuids as sharedId (sharedId)}
						{#if workspace.sharedUsersInfo.get(sharedId)}
							{@render userCard(workspace.sharedUsersInfo.get(sharedId)!, sharedId)}
						{/if}
					{/each}

					<Popover.Root bind:open={addSharedUserPopoverOpen}>
						<Popover.Trigger>
							{#snippet child({ props })}
								<Button
									{...props}
									variant="outline"
									class="mt-2 w-full"
									aria-expanded={addSharedUserPopoverOpen}
								>
									<UserPlusIcon />
									Add people
								</Button>
							{/snippet}
						</Popover.Trigger>
						<Popover.Content class="flex p-0">
							<!-- <Command.Root>
							<Command.Input placeholder="Search users..." />
							<Command.List></Command.List>
						</Command.Root> -->
							<Input placeholder="Add by username" bind:value={addSharedUserInput} />
							<!-- <Button variant="outline" onclick={() => addSharedUser(addSharedUserInput)}>Add</Button> -->
						</Popover.Content>
					</Popover.Root>
				</div>

				<Sheet.Footer>
					<Sheet.Close class={buttonVariants({ variant: 'outline' })}>Close</Sheet.Close>
				</Sheet.Footer>
			</Sheet.Content>
		</Sheet.Root>
	</Card.Footer>
</Card.Root>

{#snippet username({ name, login }: GitHubUserInfo)}
	{#if name}
		{name} ({login})
	{:else}
		{login}
	{/if}
{/snippet}

{#snippet userCard(githubUserInfo: GitHubUserInfo, userUuid: Uuid)}
	<div class="flex items-center gap-2 p-2">
		<img src="https://avatars.githubusercontent.com/u/{githubUserInfo.id}" alt={githubUserInfo.login} class="h-6 w-6 rounded-full" />
		{@render username(githubUserInfo)}
		{#if userUuid !== workspace.ownerUuid}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button {...props} variant="outline" class="ml-auto">
							<EllipsisIcon />
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>

				<DropdownMenu.Content align="end">
					<DropdownMenu.Group>
						{#if yourID === workspace.ownerUuid && userUuid !== yourID}
							<DropdownMenu.Item>
								<UsersIcon />
								Transfer ownership
							</DropdownMenu.Item>
						{/if}
						{#if userUuid !== workspace.ownerUuid}
							<DropdownMenu.Item onclick={() => removeSharedUser(userUuid)}>
								<UserMinusIcon />
								Remove access
							</DropdownMenu.Item>
						{/if}
					</DropdownMenu.Group>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		{/if}
	</div>
{/snippet}
