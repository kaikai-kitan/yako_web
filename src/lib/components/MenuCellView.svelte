<script>
	let { menuItem } = $props();
</script>

<div class="menu-cell-container">
	<div class="menu-image-container">
		{#if menuItem.image !== ""}
			<img class="menu-image" src={menuItem.image} alt={menuItem.name} />
		{:else}
			<div class="no-image">NO IMAGE</div>
		{/if}
	</div>
	<h3 class="menu-title">{@html menuItem.name}</h3>
</div>

<style>
	.menu-cell-container {
		width: 100%;
    padding: 10px;
	}

	.menu-title {
		font-size: 1.2rem;
		margin-bottom: 1rem;
		color: #26201a;
		flex-grow: 1; /* タイトルの高さが揃うように調整 */
		line-height: 34px;
		text-align: center;
	}

	.menu-image-container {
		width: 100%;
		margin-bottom: 1rem;
		aspect-ratio: 3 / 4; /* 画像のアスペクト比を4:3に */
	}

	.menu-image {
		width: 100%;
		height: 100%;
		object-fit: cover; /* 画像がコンテナにフィットするように */
		clip-path: polygon(
			0% 20px,
			20px 0%,
			100% 0px,
			100% calc(100% - 20px),
			calc(100% - 20px) 100%,
			0px 100%
		);
	}

	.no-image {
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		background: rgb(238, 217, 192);
		clip-path: polygon(
			0% 20px,
			20px 0%,
			100% 0px,
			100% calc(100% - 20px),
			calc(100% - 20px) 100%,
			0px 100%
		);
	}
</style>
