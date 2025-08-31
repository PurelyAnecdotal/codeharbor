<script lang="ts">
	let { children } = $props();
</script>

<div class="m-8">
	<svelte:boundary>{@render children()}</svelte:boundary>
</div>
