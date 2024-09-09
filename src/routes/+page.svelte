<script lang="ts">
	import type { BundleIndex } from '$lib/patchcdn/index-store';
  import { onMount } from 'svelte';

  let loader;
  let index: BundleIndex;
  let db: any;
  let dirs: string[] = [];
  let dirContents: any = [];
  let fileContent: Uint8Array | null = null;

  // Ensure this runs only in the browser, with dynamic import
  onMount(async () => {
    if (typeof window !== 'undefined') {
      console.log('Loading patch');

      // Dynamically import the necessary modules to avoid SSR issues
      const { BundleLoader } = await import('$lib/patchcdn/cache');
      const { BundleIndex } = await import('$lib/patchcdn/index-store');
      const { DatSchemasDatabase } = await import('$lib/dat-viewer/db');

      loader = new BundleLoader();
      await loader.setPatch('3.25.1.1.3');

      index = new BundleIndex(loader);
      await index.loadIndex();

      db = new DatSchemasDatabase(index);
      await db.fetchSchema();

      // Load root directories initially
      dirs = index.getRootDirs() || [];
    }
  });

  async function loadDirContents(dirPath: string) {
    if (typeof window !== 'undefined') {
      dirContents = index.getDirContent(dirPath) || [];
      console.log('Loaded dir contents:', dirContents);
      
    }
  }

  async function loadFileContent(filePath: string) {
    if (typeof window !== 'undefined') {
      fileContent = await index.loadFileContent(filePath);
      const schema = await db.findSchemaByName(filePath.replace('data/', '').replace('.dat64', ''));
      console.log('Loaded file content:', fileContent, 'Schema:', schema);
    }
  }
</script>

<h3>Directories</h3>
<ul>
  {#each dirs as dir}
    <li on:click={() => loadDirContents(dir)}>{dir}</li>
  {/each}
</ul>

<h3>Directory Contents</h3>
<ul>
  <!-- <pre>{dirContents}</pre> -->
   <!-- await and then iterate over the dirContents -->
  {#each Object.keys(dirContents) as file}
    <li on:click={() => loadFileContent(file)}>{file}</li>
  {/each}
</ul>

{#if fileContent}
  <h3>File Content</h3>
  <pre>{fileContent}</pre>
{/if}
