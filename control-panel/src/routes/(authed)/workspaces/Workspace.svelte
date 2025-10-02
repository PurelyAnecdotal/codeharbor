<script lang="ts">
	import { page } from '$app/state';
	import GithubAvatar from '$lib/components/GithubAvatar.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index';
	import Badge from '$lib/components/ui/badge/badge.svelte';
	import Button, { buttonVariants } from '$lib/components/ui/button/button.svelte';
	import * as Card from '$lib/components/ui/card';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index';
	import Input from '$lib/components/ui/input/input.svelte';
	import * as Popover from '$lib/components/ui/popover/index';
	import * as Sheet from '$lib/components/ui/sheet/index';
	import type { ErrorTypes, Tagged } from '$lib/error';
	import { JtoR } from '$lib/result';
	import type { WorkspaceContainerInfo } from '$lib/server/workspaces';
	import type { Uuid } from '$lib/types';
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
	import { toast } from 'svelte-sonner';
	import {
		deleteWorkspace,
		getWorkspaces,
		getWorkspaceStats,
		shareWorkspace,
		startWorkspace,
		stopWorkspace,
		unshareWorkspace
	} from './workspaces.remote';

	interface Props {
		workspace: WorkspaceContainerInfo;
	}

	const { workspace }: Props = $props();

	let starting = $state(false);
	let stopping = $state(false);
	let deleting = $state(false);

	async function start() {
		starting = true;
		JtoR(await startWorkspace(workspace.uuid).updates(getWorkspaces()))
			.orTee(handleWithToast('Failed to start workspace'))
			.orTee(console.log);
		starting = false;
	}

	async function stop() {
		stopping = true;
		JtoR(await stopWorkspace(workspace.uuid).updates(getWorkspaces())).orTee(
			handleWithToast('Failed to start workspace')
		);
		stopping = false;
	}

	async function deleteMe() {
		deleting = true;
		JtoR(await deleteWorkspace(workspace.uuid).updates(getWorkspaces())).orTee(
			handleWithToast('Failed to start workspace')
		);
		deleting = false;
	}

	async function addSharedUser(userUuidToShare: Uuid) {
		JtoR(await shareWorkspace({ workspaceUuid: workspace.uuid, userUuidToShare }))
			.andTee(() => toast.success('Workspace shared with user'))
			.orTee(handleWithToast('Failed to share workspace with user'));
	}

	async function removeSharedUser(userUuidToUnshare: Uuid) {
		JtoR(await unshareWorkspace({ workspaceUuid: workspace.uuid, userUuidToUnshare }))
			.andTee(() => toast.success('Workspace shared with user'))
			.orTee(handleWithToast('Failed to share workspace with user'));
	}

	const handleWithToast = (errMsg: string) => (err: Tagged<ErrorTypes>) =>
		toast.error(errMsg, { description: err.message });

	const yourID = $derived(page.data.user?.uuid!);

	let addSharedUserPopoverOpen = $state(false);

	let addSharedUserInput = $state('');

	const percentFormatter = new Intl.NumberFormat('en-US', {
		style: 'percent',
		minimumFractionDigits: 0,
		maximumFractionDigits: 2
	});

	const statsQuery = getWorkspaceStats(workspace.uuid);

	const pageUrlObj = new URL(page.url);

	const openVSCodeServerPort = 3000;

	const uuidUrl = `${pageUrlObj.protocol}//${workspace.uuid}-${openVSCodeServerPort}.${pageUrlObj.host}/?folder=${workspace.folder}`;
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
		{#if workspace.template}
			<Card.Description>
				<a
					href="https://github.com/{workspace.template.ghRepoOwner}/{workspace.template.ghRepoName}"
					target="_blank"
					class="flex items-center gap-1"
				>
					<GithubIcon class="w-4" />
					{workspace.template.name}
				</a>
			</Card.Description>
		{/if}
		<!-- {#if workspace.ownerId !== page.data.session?.id && workspace.ownerInfo}
			<Badge variant="default">
				Owned by {@render username(workspace.ownerInfo)}
			</Badge>
		{/if} -->
		{#if workspace.usageLimits}
			<div class="flex gap-2">
				{#if workspace.usageLimits.cpusLimit !== undefined}
					<Badge variant="outline">
						CPUs: {workspace.usageLimits.cpusLimit}
					</Badge>
				{/if}

				{#if workspace.usageLimits.memoryLimitGiB !== undefined}
					<Badge variant="outline">
						Memory: {workspace.usageLimits.memoryLimitGiB} GiB
					</Badge>
				{/if}
			</div>
		{/if}
	</Card.Header>

	<Card.Footer class="flex gap-2">
		{#if workspace.state === 'exited' || workspace.state === 'created'}
			<Button onclick={start} variant="outline" disabled={starting}>
				<PlayIcon />
				Start
				{#if starting}
					<LoaderCircleIcon class="animate-spin" />
				{/if}
			</Button>
		{:else if workspace.state === 'running'}
			<Button href={uuidUrl} target="_blank">
				<ScreenShareIcon />
				Open
			</Button>
			<Button onclick={stop} variant="outline" disabled={stopping}>
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
					disabled={deleting || yourID !== workspace.owner.uuid}
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
						<AlertDialog.Action onclick={deleteMe}>Continue</AlertDialog.Action>
					</AlertDialog.Footer>
				</AlertDialog.Content>
			</AlertDialog.Root>
		{/if}

		<Sheet.Root>
			<Sheet.Trigger class={buttonVariants({ variant: 'outline' })}>
				<Share2Icon />
				Share
				{#if workspace.sharedUsers.length > 0}
					<Badge class="h-5 min-w-5 rounded-full px-1 tabular-nums" variant="outline">
						{workspace.sharedUsers.length}
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

					{@render userCard(workspace.owner)}

					<div class="mt-4 text-sm font-medium">Shared with</div>

					{#each workspace.sharedUsers as sharedUser (sharedUser.uuid)}
						{@render userCard(sharedUser)}
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

		{#if statsQuery.ready}
			{#if statsQuery.current.isOk()}
				{@render stats(statsQuery.current.value)}
			{:else}
				Failed to get stats: {statsQuery.current.error.message}
			{/if}
		{/if}
	</Card.Footer>
</Card.Root>

{#snippet userCard({
	uuid: userUuid,
	name,
	ghId,
	ghLogin
}: {
	uuid: Uuid;
	name: string | null;
	ghId: number;
	ghLogin: string;
})}
	<div class="flex items-center gap-2 p-2">
		<GithubAvatar {ghId} {ghLogin} />

		{name ?? ghLogin}

		{#if userUuid !== workspace.owner.uuid}
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
						{#if yourID === workspace.owner.uuid && userUuid !== yourID}
							<DropdownMenu.Item>
								<UsersIcon />
								Transfer ownership
							</DropdownMenu.Item>
						{/if}
						{#if userUuid !== workspace.owner.uuid}
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

{#snippet stats({ cpuUsage, memoryUsage }: { cpuUsage?: number; memoryUsage?: number })}
	{#if cpuUsage !== undefined}
		CPU Usage: {percentFormatter.format(cpuUsage)}
	{/if}
	{#if memoryUsage !== undefined}
		Memory Usage: {percentFormatter.format(memoryUsage)}
	{/if}
{/snippet}
