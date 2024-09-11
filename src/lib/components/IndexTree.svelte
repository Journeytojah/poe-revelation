<script lang="ts">
	import type { Header } from '$lib/dat-viewer/headers';
	import type { BundleIndex } from '$lib/patchcdn/index-store';
	import type { DatFile } from 'pathofexile-dat/dat.js';
	import { onMount } from 'svelte';

	let loader;
	let index: BundleIndex;
	let db: any;
	let dirs: string[] = [];
	let dirContents: { files: string[]; dirs: string[] } = { files: [], dirs: [] };
	let fileContent: Uint8Array | null = null;
	let headers: Header[] = []; // Store headers here
	let currentPath: string = '';
	let rows: any[] = []; // To store rows from the .dat file

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
		dirContents = { dirs: contents.dirs, files: contents.files };
	}

	// Load file content
	async function loadFileContent(filePath: string) {
		fileContent = await index.loadFileContent(filePath); // Load file content

		// Extract schema name
		const schemaName = filePath.replace('data/', '').replace('.dat64', '');

		// Dynamically import necessary functions
		const { readDatFile, readColumn } = await import('pathofexile-dat/dat.js');
		const { analyzeDatFile } = await import('$lib/worker/interface');
		const { fromSerializedHeaders } = await import('$lib/dat-viewer/headers');

		// Parse `.dat64` file
		const datFile = readDatFile(filePath, fileContent);
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
			console.log('Loaded file headers:', headers);

			// Time the operation of extracting rows
			const startTime = performance.now();

			// Extract rows from the datFile using the headers
			rows = await extractRows(datFile, headers);
			console.log('Extracted rows:', rows);

			const endTime = performance.now();
			console.log(`Extracting rows took ${endTime - startTime} milliseconds`);
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
	<h3>Directory Contents</h3>
	{#if currentPath}
		<button type="button" class="btn variant-outline-primary w-full" on:click={goUp}>Go Up</button>
	{/if}
	<ul>
		{#each dirContents.dirs as dir}
			<!-- <li on:click={() => loadDirContents(dir)}><strong>{dir}</strong></li> -->
       <li>
         <button type="button" class="btn variant-ghost-primary w-full truncate" on:click={() => loadDirContents(dir)}>
           {dir}
          </button>
        </li>
		{/each}
	</ul>

	<div class=" flex-col">
		<div style="gap: 1rem;">
			<!-- Directory Contents and Files -->
			<div style="flex: 3;">
				<h4>Files</h4>
				<ul>
					{#each dirContents.files as file}
						<!-- <li on:click={() => loadFileContent(`${file}`)}>{file}</li> -->
            <li>
              <button type="button" class="btn variant-ghost-primary w-full" on:click={() => loadFileContent(`${file}`)}>
                <p class="truncate">
                  {file.split('/').pop()}
                </p>
              </button>
            </li>
					{/each}
				</ul>
			</div>
		</div>
	</div>
</section>

<section class=" w-3/4 max-h-screen overflow-scroll">
	<!-- Display the data rows -->
	{#if rows.length > 0}
		<h3>Data Rows</h3>

		<div class="table-auto">
			<table class="table table-hover">
				<thead>
					<tr>
						<th>#</th>
						<!-- Index column -->
						{#each headers as header}
							<th class="text-center">
								<p>{header.name}</p>
								<p>Length: {header.length}</p>
							</th>
							<!-- Use the header name, including Unnamed X -->
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each rows as row, i}
						<tr>
							<td>{i + 1}</td>
							{#each headers as header}
								<!-- TODO: Keep an eye of the comparison with falsy values, it might replace data. -->
								<td
									>{header.name
										? row[header.name] === ''
											? 'empty'
											: row[header.name]
										: 'Unnamed'}</td
								>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
