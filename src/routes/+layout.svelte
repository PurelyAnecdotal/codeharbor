<script lang="ts">
	import { page } from '$app/state';
	import Button, { buttonVariants } from '$lib/components/ui/button/button.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import CircleUser from '@lucide/svelte/icons/circle-user';
	import DiamondIcon from '@lucide/svelte/icons/diamond';
	import GitHub from '@lucide/svelte/icons/github';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from 'svelte-sonner';
	import '../app.css';

	let { children } = $props();

	const user = $derived(page.data.user);
</script>

<ModeWatcher />

<Toaster />

<div class="flex h-screen flex-col">
	<div class="m-4 flex justify-between">
		<a href="/" class="flex items-center">
			<DiamondIcon class="h-4" />
			Annex
		</a>

		{#if user}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger class={buttonVariants({ variant: 'ghost' })}>
					{#if user}
						<img
							src="https://avatars.githubusercontent.com/{user.ghLogin}?s=32"
							alt="User Avatar"
							class="h-4 w-4 rounded-full"
						/>
					{:else}
						<CircleUser />
					{/if}
					{user.ghLogin}
					<ChevronDown />
				</DropdownMenu.Trigger>

				<DropdownMenu.Content class="w-56">
					<DropdownMenu.Item>
						<LogOutIcon />Log out
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		{:else}
			<Button href="/login/github">
				<GitHub />Log in
			</Button>
		{/if}
	</div>
	{@render children()}
</div>
