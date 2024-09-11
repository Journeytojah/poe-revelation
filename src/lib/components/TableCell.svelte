<script lang="ts">
  export let showBytes: boolean = false;
  export let bytes: any;
  export let value: any;
</script>

<td>
  {#if showBytes}
    <span>
      DEEZ BYTES
    </span>
  {:else}
    <span>
      {value}
    </span>
  {/if}
</td>
