<script lang="ts">
	import { page } from '$app/state';
	import Button, { buttonVariants } from '$lib/components/ui/button/button.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { signIn, signOut } from '@auth/sveltekit/client';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import CircleUser from '@lucide/svelte/icons/circle-user';
	import GitHub from '@lucide/svelte/icons/github';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import { ModeWatcher } from 'mode-watcher';

	import '../app.css';

	let { children } = $props();
</script>

<ModeWatcher />

<div class="m-4 flex justify-between">
	<a href="/">Annex</a>

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

<div class="m-8">
	{@render children()}
</div>
