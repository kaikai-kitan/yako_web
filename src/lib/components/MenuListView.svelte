<script>
	import MenuCellView from '$lib/components/MenuCellView.svelte';

	let { menuCategory } = $props();
</script>

<div class="menu-list-container">
	<h1 class="menu-category-name">{menuCategory.name}</h1>
	{#each menuCategory.sections as menuSection}
		<h2 class="menu-section-name">{menuSection.name}</h2>
		<div class="menu-section-container">
			{#each menuSection.items as menuItem}
        <div class="menu-cell-container">
          <MenuCellView {menuItem} />
        </div>
			{/each}
		</div>
	{/each}
</div>

<style>
	.menu-list-container {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
    max-width: 800px;
    margin: auto;
	}

	.menu-category-name {
		text-align: center;
		color: #26201a;
		margin-top: 2rem;
		margin-bottom: 1rem;
	}

	.menu-section-name {
		text-align: center;
		border-bottom: 2px solid #d56d04;
		display: inline-block;
		margin-bottom: 2rem;
	}

	.menu-section-container {
    width: 100%;
		display: flex;
		flex-direction: row;
    gap: 10px;
		justify-content: flex-start;
		align-items: flex-start;
	}

  .menu-cell-container {
    width: 33.33%;
  }
</style>
