<script lang="ts">
	interface Props {
		ghId: number;
		ghLogin: string;
	}

	const { ghId, ghLogin }: Props = $props();
</script>

<img
	src="https://avatars.githubusercontent.com/u/{ghId}?s=32"
	alt={ghLogin}
	class="h-6 w-6 rounded-full"
/>
