<script lang="ts">
	import type { Header } from '$lib/dat-viewer/headers';
	import type { BundleIndex } from '$lib/patchcdn/index-store';
  import { onMount } from 'svelte';
  
  let loader;
  let index: BundleIndex;
  let db: any;
  let dirs: string[] = [];
  let dirContents: { files: string[], dirs: string[] } = { files: [], dirs: [] };
  let fileContent: Uint8Array | null = null;
  let headers: Header[] = []; // Store headers here
  let currentPath: string = '';
  let schemaName: string;
  
  // Ensure this runs only in the browser, with dynamic import
  onMount(async () => {
    if (typeof window !== 'undefined') {
      console.log('Loading patch');
      
      // Dynamically import the necessary modules to avoid SSR issues
      const { readDatFile, analyzeDatFile } = await import('pathofexile-dat/dat.js');
      const { BundleLoader } = await import('$lib/patchcdn/cache');
      const { BundleIndex } = await import('$lib/patchcdn/index-store');
      const { DatSchemasDatabase } = await import('$lib/dat-viewer/db');
      const { fromSerializedHeaders } = await import('$lib/dat-viewer/headers');

      loader = new BundleLoader();
      await loader.setPatch('3.25.1.1.3');

      index = new BundleIndex(loader);
      await index.loadIndex();

      db = new DatSchemasDatabase(index);
      await db.fetchSchema();

      // Load root directories initially
      currentPath = ''; // Root path
      dirs = index.getRootDirs() || [];
      await loadDirContents(currentPath);  // Initialize root directory
    }
  });

  async function loadDirContents(dirPath: string) {
    if (typeof window !== 'undefined') {
      currentPath = dirPath;  // Update current path

      // Get the directory contents (already separated into dirs and files)
      const contents = index.getDirContent(dirPath) || { files: [], dirs: [] };
      console.log('Loaded dir contents:', contents);

      // Update dirContents with the structure returned from getDirContent
      dirContents = {
        dirs: contents.dirs,  // Directories
        files: contents.files  // Files
      };
    }
  }

 async function loadFileContent(filePath: string) {
  // Load the file content
  fileContent = await index.loadFileContent(filePath);

  // Extract the schema name from the file path
  const schemaName = filePath.replace('data/', '').replace('.dat64', '');

  // Dynamically import `readDatFile` and `analyzeDatFile`
  const { readDatFile } = await import('pathofexile-dat/dat.js');
  const { analyzeDatFile } = await import('$lib/worker/interface');  // Adjust import path
  const { fromSerializedHeaders } = await import('$lib/dat-viewer/headers');

  // Parse the `.dat64` file using `readDatFile`
  const datFile = readDatFile(filePath, fileContent);

  // Analyze the `.dat64` file to get column statistics
  const columnStats = await analyzeDatFile(datFile);

  // Find the serialized headers from the schema database
  const serializedHeaders = await db.findByName(schemaName);

  // Deserialize the headers
  const headersResult = fromSerializedHeaders(serializedHeaders, columnStats, datFile);
  
  // Check if the headers are valid and update the headers variable
  if (headersResult) {
    headers = headersResult.headers;
    console.log('Loaded file headers:', headers);
  } else {
    console.warn(`Invalid headers for file: ${schemaName}`);
  }
}


  function goUp() {
    if (currentPath) {
      const parts = currentPath.split('/');
      parts.pop(); // Remove the last part
      const parentDir = parts.join('/');
      loadDirContents(parentDir);
    }
  }
</script>


<section class="container">
<h3>Directories</h3>
{#if currentPath}
  <button on:click={goUp}>Go Up</button>
{/if}
<ul>
  {#each dirs as dir}
    <li on:click={() => loadDirContents(dir)}><strong>{dir}</strong></li>
  {/each}
</ul>
</section>

<section class="container">

<h3>Directory Contents</h3>
<!-- Separate Directories and Files -->
<h4>Subdirectories</h4>
<ul>
  {#each dirContents.dirs as dir}
    <li on:click={() => loadDirContents(`${currentPath}/${dir}`)}><strong>{dir}</strong></li>
  {/each}
</ul>
</section>

<section class="container">
<h4>Files</h4>
<ul>
  {#each dirContents.files as file}
    <li on:click={() => loadFileContent(`${currentPath}/${file}`)}>{file}</li>
  {/each}
</ul>

{#if fileContent}
  <h3>File Content</h3>
  <pre>{fileContent}</pre>
{/if}
</section>

<section class="container">
  <h3>File Headers</h3>
{#if headers.length > 0}
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Offset</th>
        <th>Length</th>
        <th>Type</th>
      </tr>
    </thead>
    <tbody>
      {#each headers as header}
        <tr>
          <td>{header.name ? header.name : 'Unnamed'}</td>
          <td>{header.offset}</td>
          <td>{header.length}</td>
          <td>
            {#if header.type.integer}
              Integer (Size: {header.type.integer.size}, Unsigned: {header.type.integer.unsigned})
            {:else if header.type.string}
              String
            {:else if header.type.decimal}
              Decimal (Size: {header.type.decimal.size})
            {:else if header.type.boolean}
              Boolean
            {:else if header.type.key}
              Key (Foreign: {header.type.key.foreign}, Table: {header.type.key.table || 'None'})
            {:else if header.type.byteView}
              ByteView (Array: {header.type.byteView.array})
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{:else}
  <p>No headers available for this file.</p>
{/if}
</section>