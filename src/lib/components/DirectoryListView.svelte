<!-- 夜行人図鑑のリスト -->
<script>
	import DirectoryCellView from './DirectoryCellView.svelte';

	let { directoryList, selectedId = null } = $props();
</script>

<div class="directory-list-container">
	{#each directoryList as directoryItem}
		<div
			id={directoryItem.id ? `yakonin-${directoryItem.id}` : undefined}
			class="directory-cell-container"
			class:selected={selectedId && directoryItem.id === selectedId}
		>
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
    scroll-margin-top: 80px;
    border-radius: 4px;
	}

  .directory-cell-container:hover {
    transform: translateY(-5px);
  }

  .directory-cell-container.selected {
    box-shadow: 0 0 0 3px #d56d04, 0 6px 18px rgba(213, 109, 4, 0.25);
    transform: translateY(-3px);
  }
</style>
