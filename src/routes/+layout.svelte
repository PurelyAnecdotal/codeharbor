<script lang="ts">
	import { ModeWatcher } from 'mode-watcher';
	import '../app.css';
	import GitHub from '@lucide/svelte/icons/github';
	import CircleUser from '@lucide/svelte/icons/circle-user';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import { page } from '$app/state';
	import Button, { buttonVariants } from '$lib/components/ui/button/button.svelte';
	import { signIn, signOut } from '@auth/sveltekit/client';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';

	let { children } = $props();
</script>

<ModeWatcher />

<div class="m-4 flex justify-between">
	Annex
	{#if page.data.session}
		<DropdownMenu.Root>
			<DropdownMenu.Trigger class={buttonVariants({ variant: 'ghost' })}>
				{#if page.data.session.user?.image}
					<img src={page.data.session.user.image} alt="User Avatar" class="h-4 w-4 rounded-full" />
				{:else}
					<CircleUser />
				{/if}
				{page.data.session.user?.name}
				<ChevronDown />
			</DropdownMenu.Trigger>

			<DropdownMenu.Content class="w-56">
				<DropdownMenu.Item onclick={() => signOut()}>
					<LogOutIcon />Log out
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	{:else}
		<Button onclick={() => signIn('github')}>
			<GitHub />Log in
		</Button>
	{/if}
</div>


{@render children()}
