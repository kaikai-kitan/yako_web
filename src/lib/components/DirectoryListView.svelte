<!-- 夜行人図鑑のリスト -->
<script>
	import DirectoryCellView from './DirectoryCellView.svelte';

	let { directoryList } = $props();
</script>

<div class="directory-list-container">
	{#each directoryList as directoryItem}
		<div class="directory-cell-container">
			<DirectoryCellView {directoryItem} />
		</div>
	{/each}
</div>

<style>
	.directory-list-container {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.directory-cell-container {
		width: 100%;
    transition: all 0.3s ease-out;
	}

  .directory-cell-container:hover {
    transform: translateY(-5px);
  }
</style>
