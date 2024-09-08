<script lang="ts">
  import { onMount } from 'svelte';
  import { decompressBundle } from '../worker/interface'; // Adjust path as needed

  let result: any;


  onMount(async () => {
    const bundle = await fetch('./bundle.index.bin').then(res => res.arrayBuffer());
    result = await decompressBundle(bundle);
    console.log(result);
  });
</script>

<div>
  {#if result}
    <p>Decompression Result: {result}</p>
  {/if}
</div>
