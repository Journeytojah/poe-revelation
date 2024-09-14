<script lang="ts">
	export let showBytes: boolean = false;
	export let bytes: any;
	export let value: any;
</script>

{#if showBytes}
	<span> DEEZ BYTES </span>
{:else}
	<span class="text-center truncate">
		{value}
	</span>
{/if}
