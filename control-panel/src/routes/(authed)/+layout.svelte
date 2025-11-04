<script lang="ts">
	let { children } = $props();
</script>

<div class="m-8">
	<svelte:boundary>
		{@render children()}
	
		{#snippet failed(err)} -->
			<p class="text-red-500">Failed to load: {Error.isError(err) ? err.message : String(err)}</p>
		{/snippet}
	</svelte:boundary>
</div>
