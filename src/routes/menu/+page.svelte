<!-- メニュー -->
<script>
	import MenuListView from '$lib/components/MenuListView.svelte';
	import menuCategories from '$lib/assets/data/menu.json';
</script>

<main>
	{#each menuCategories as menuCategory}
		<MenuListView {menuCategory}></MenuListView>
	{/each}
</main>

<style>
	main {
    max-width: 1200px;
    margin: auto;
	}
</style>
