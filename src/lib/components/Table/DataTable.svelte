<script>
	//Import local datatable components
	import ThSort from '$lib/components/Table/ThSort.svelte';
	import ThFilter from '$lib/components/Table/ThFilter.svelte';
	import Search from '$lib/components/Table/Search.svelte';
	import RowsPerPage from '$lib/components/Table/RowsPerPage.svelte';
	import RowCount from '$lib/components/Table/RowCount.svelte';
	import Pagination from '$lib/components/Table/Pagination.svelte';

	//Import handler from SSD
	import { DataHandler } from '@vincjo/datatables';

	/**
	 * @type {any[] | undefined}
	 */
	 export let rows = [];
	/**
	 * @type {any[]}
	 */
	 export let headers = [];

	//Init data handler
	const handler = new DataHandler(rows, { rowsPerPage: 50 });
	const filteredRows = handler.getRows();
</script>

<div class="overflow-x-auto space-y-4 h-screen">
	<!-- Header -->
	<header class="flex justify-between gap-4 sticky left-0">
		<Search {handler} />
		<RowsPerPage {handler} />
    <RowCount {handler} />
		<Pagination {handler} />
	</header>

	<!-- Table -->
	<table class="table table-hover table-compact w-full table-auto">
		<thead>
			<tr>
				{#each headers as header}
					<ThSort {handler} orderBy={header.name}>{header.name}</ThSort>
				{/each}
			</tr>
			<tr>
				{#each headers as header}
					<ThFilter {handler} filterBy={header.name} />
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each $filteredRows as row}
				<tr>
					{#each headers as header}
						<td>{row[header.name]}</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>

	<!-- Footer -->
	<footer class="flex justify-between fixed z-50">

	</footer>
</div>