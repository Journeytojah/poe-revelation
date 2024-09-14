<script lang="ts">
	import type { Header } from '$lib/dat-viewer/headers';
	import type { BundleIndex } from '$lib/patchcdn/index-store';
	import type { DatFile } from 'pathofexile-dat/dat.js';
	import { onMount } from 'svelte';
	import TableCell from './TableCell.svelte';
  import { Grid, List } from "svelte-virtual";


	let loader;
	let index: BundleIndex;
	let db: any;
	let dirs: string[] = [];
	let dirContents: { files: string[]; dirs: string[] } = { files: [], dirs: [] };
	let fileContent: Uint8Array | null = null;
	let headers: Header[] = []; // Store headers here
	let currentPath: string = '';
	let datFile: DatFile | null = null;
	let rows: any[] = []; // To store rows from the .dat file
	let searchTerm: string = '';
	let loading: boolean = false;

	let showBytesByColumn: boolean[] = []; // Track column toggle states

	function toggleColumn(index: number) {
		showBytesByColumn[index] = !showBytesByColumn[index];
	}

	$: filteredFiles = dirContents.files.filter((file) => {
		if (!searchTerm) return true;
		return file.includes(searchTerm);
	});

	onMount(async () => {
		const { BundleLoader } = await import('$lib/patchcdn/cache');
		const { BundleIndex } = await import('$lib/patchcdn/index-store');
		const { DatSchemasDatabase } = await import('$lib/dat-viewer/db');

		loader = new BundleLoader();
		await loader.setPatch('3.25.1.1.3'); // Set the patch version

		index = new BundleIndex(loader);
		await index.loadIndex(); // Load index

		db = new DatSchemasDatabase(index);
		await db.fetchSchema(); // Fetch schemas

		// Load root directories
		currentPath = '';
		dirs = index.getRootDirs() || [];
		await loadDirContents(currentPath); // Initialize root directory
	});

	// Load directory contents
	async function loadDirContents(dirPath: string) {
		currentPath = dirPath; // Update current path

		const contents = index.getDirContent(dirPath) || { files: [], dirs: [] };
    // filter out the files that are not .dat64
    contents.files = contents.files.filter((file) => file.endsWith('.dat64'));
		dirContents = { dirs: contents.dirs, files: contents.files };
	}

	// Load file content
	async function loadFileContent(filePath: string) {
		loading = true;
		fileContent = await index.loadFileContent(filePath); // Load file content

		// Extract schema name
		const schemaName = filePath.replace('data/', '').replace('.dat64', '');

		// Dynamically import necessary functions
		const { readDatFile } = await import('pathofexile-dat/dat.js');
		const { analyzeDatFile } = await import('$lib/worker/interface');
		const { fromSerializedHeaders } = await import('$lib/dat-viewer/headers');

		// Parse `.dat64` file
		datFile = readDatFile(filePath, fileContent);
		const columnStats = await analyzeDatFile(datFile);

		// Find and apply headers
		const serializedHeaders = await db.findByName(schemaName);
		const headersResult = fromSerializedHeaders(serializedHeaders, columnStats, datFile);

		if (headersResult) {
			// Assign default names to unnamed headers
			headers = headersResult.headers.map((header, index) => ({
				...header,
				name: header.name ? header.name : `Unnamed ${index}`
			}));
			// console.log('Loaded file headers:', headers);

			// Time the operation of extracting rows
			// const startTime = performance.now();

			// Extract rows from the datFile using the headers
			rows = await extractRows(datFile, headers);
			// console.log('Extracted rows:', rows);

			// const endTime = performance.now();
			// console.log(`Extracting rows took ${endTime - startTime} milliseconds`);

			loading = false;
		} else {
			console.warn(`Invalid headers for file: ${schemaName}`);
		}
	}

	// Function to extract rows from datFile based on the headers
	async function extractRows(datFile: DatFile, headers: Header[]) {
		// Dynamically import necessary functions
		const { readColumn } = await import('pathofexile-dat/dat.js');

		const rows = [];
		for (let i = 0; i < datFile.rowCount; i++) {
			const row: { [key: string]: any } = {};
			for (const header of headers) {
				const value = await readColumn(header, datFile)[i];
				if (header.name) {
					row[header.name] = value;
				}
			}
			rows.push(row);
		}
		return rows;
	}

	// Navigate up one directory level
	function goUp() {
		if (currentPath) {
			const parts = currentPath.split('/');
			parts.pop();
			loadDirContents(parts.join('/'));
		}
	}
</script>

<section class=" overflow-y-scroll w-1/4">
	<input
		class="input"
		bind:value={searchTerm}
		title="Input (search)"
		type="search"
		placeholder="Filter files..."
	/>
	<hr class="mb-2" />
	{#if currentPath}
		<button type="button" class="btn variant-outline-primary w-full my-2" on:click={goUp}
			>Go Up</button
		>
	{/if}
	<ul >
		{#each dirContents.dirs as dir}
			<!-- <li on:click={() => loadDirContents(dir)}><strong>{dir}</strong></li> -->
			<li>
				<button
					type="button"
					class="btn variant-ghost-primary w-full truncate"
					on:click={() => loadDirContents(dir)}
				>
					{dir}
				</button>
			</li>
		{/each}
	</ul>

	<div class=" flex-col">
		<div style="gap: 1rem;">
			<!-- Directory Contents and Files -->
			<div style="flex: 3;">
				<hr class="mb-2" />
				<!-- <ul>
					{#each filteredFiles as file}
						<li>
							<button
								type="button"
								class="btn variant-ghost-primary w-full"
								on:click={() => loadFileContent(`${file}`)}
							>
								<p class="truncate">
									{file.split('/').pop()}
								</p>
							</button>
						</li>
					{/each}
				</ul> -->

       <!-- Adjust the outer container to hold the virtual list properly -->
	<div class="file-list-container" style="position: relative; max-height: 400px; overflow: auto;">
		<List
			itemCount={filteredFiles.length}
			itemSize={40}
			height={"400px"}
			scrollBehavior="smooth"
			overScan={10}
		>
			<div slot="item" let:index let:style {style} class="list-item">
				<button
					type="button"
					class="btn variant-ghost-primary w-full"
					on:click={() => loadFileContent(`${filteredFiles[index]}`)}
				>
					<p class="truncate">
						{filteredFiles[index].split('/').pop()}
					</p>
				</button>
			</div>
		</List>
	</div>
			</div>
		</div>
	</div>
</section>

<section class=" w-3/4 max-h-screen">
	<!-- Display the data rows -->
	<!-- 
      We needed to fix the table being painted in the DOM twice.
      And we did fix it. 
      
      "Just dont paint the table twice 4head" - OneRobotBoii 2024
  -->
	<!-- Virtualized Grid replacing the table -->
	{#if !loading}
		<Grid
			itemCount={rows.length * (headers.length + 1)}
			itemHeight={50}
			itemWidth={150}
			height={500} 
			columnCount={headers.length + 1}
      overScan={10}
		>
			<div slot="item" let:rowIndex let:columnIndex let:style {style}>
				{#if columnIndex === 0}
					<!-- Render the row index in the first column -->
					<div class="p-2">
            {rowIndex + 1}
          </div>
				{:else}
					<!-- Render the data cells -->
					<TableCell
						value={headers[columnIndex - 1].name ? rows[rowIndex][headers[columnIndex - 1].name] : 'Unnamed'}
						bytes={headers[columnIndex - 1].name ? rows[rowIndex][headers[columnIndex - 1].name] : 'Unnamed'}
						showBytes={showBytesByColumn[columnIndex - 1]}
					/>
				{/if}
			</div>
		</Grid>
	{:else}
		<!-- Loading spinner -->
		<img
			src="/newkekclose.png"
			alt="Loading..."
			class="mx-auto rounded-full object-cover animate-spin h-24 w-24"
		/>
		<h1 class="text-center">Loading...</h1>
	{/if}
</section>
