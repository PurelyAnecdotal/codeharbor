<script>
	import * as Card from '$lib/components/ui/card';
	import DiamondIcon from '@lucide/svelte/icons/diamond';
</script>

<div class="flex flex-grow items-center justify-center">
	<Card.Root>
		<Card.Header class="flex items-center justify-center">
			<DiamondIcon />
			<p class="text-xl">Annex</p>
		</Card.Header>

		<Card.Content>Annex is a self-hosted replacement for GitHub Codespaces.</Card.Content>
	</Card.Root>
</div>
