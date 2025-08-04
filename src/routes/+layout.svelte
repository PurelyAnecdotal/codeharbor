<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Button, { buttonVariants } from '$lib/components/ui/button/button.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as NavigationMenu from '$lib/components/ui/navigation-menu';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import DiamondIcon from '@lucide/svelte/icons/diamond';
	import GitHubIcon from '@lucide/svelte/icons/github';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import SquareArrowRightIcon from '@lucide/svelte/icons/square-arrow-right';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from 'svelte-sonner';
	import '../app.css';

	let { children } = $props();

	const user = $derived(page.data.user);
</script>

<ModeWatcher />

<Toaster />

<div class="flex h-screen flex-col">
	<div class="m-4 flex items-center gap-4">
		<a href="/" class="flex items-center">
			<DiamondIcon class="h-4" />
			Annex
		</a>

		{#if user}
			{#if user.name}
				{@render navbar()}
			{:else if page.route.id !== '/(authed)/welcome'}
				<a href="/welcome" class="flex items-center gap-1 rounded p-2 outline-2 outline-blue-400">
					<SquareArrowRightIcon />
					Finish setup
				</a>
			{/if}
		{/if}

		<div class="ml-auto">
			{#if user}
				{@render userDropdown(user.name ?? user.ghLogin, user.ghId)}
			{:else}
				<Button href="/login/github">
					<GitHubIcon />Log in
				</Button>
			{/if}
		</div>
	</div>
	{@render children()}
</div>

{#snippet navbar()}
	<NavigationMenu.Root>
		<NavigationMenu.List>
			{@render navlink('/workspaces', 'Workspaces')}
			{@render navlink('/templates', 'Templates')}
			{@render navlink('/admin', 'Admin')}
		</NavigationMenu.List>
	</NavigationMenu.Root>
{/snippet}

{#snippet navlink(href: string, text: string)}
	<NavigationMenu.Item>
		<NavigationMenu.Link {href}>{text}</NavigationMenu.Link>
	</NavigationMenu.Item>
{/snippet}

{#snippet userDropdown(name: string, githubId: number)}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger class={'cursor-pointer ' + buttonVariants({ variant: 'ghost' })}>
			<img
				src="https://avatars.githubusercontent.com/u/{githubId}?s=32"
				alt={name}
				class="h-6 w-6 rounded-full"
			/>
			{name}
			<ChevronDownIcon />
		</DropdownMenu.Trigger>

		<DropdownMenu.Content class="w-56">
			<DropdownMenu.Item onclick={() => goto('/settings')}>
				<SettingsIcon />Settings
			</DropdownMenu.Item>

			<DropdownMenu.Item onclick={() => goto('/logout')}>
				<LogOutIcon />Log out
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/snippet}
