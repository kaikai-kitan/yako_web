<script>
	let { menuItem } = $props();

	function formatMenuPrice(price) {
		if (price === 0) {
			return "¥ ---";
		}
		return `¥ ${price}`;
	}
</script>

<div class="menu-cell-container">
	<div class="menu-image-container">
		{#if menuItem.image !== ''}
			<img class="menu-image" src={menuItem.image} alt={menuItem.name} />
		{:else}
			<div class="no-image">NO IMAGE</div>
		{/if}
	</div>
	<div class="menu-information">
		<h3 class="menu-title">{@html menuItem.name}</h3>
		<div class="menu-price-container">
			<span class="menu-price">{formatMenuPrice(menuItem.price)}</span>
		</div>
	</div>
</div>

<style>
	.menu-cell-container {
		width: 100%;
		padding: 10px;
	}

	.menu-image-container {
		width: 100%;
		margin-bottom: 0.5rem;
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

	.menu-information {
		width: 100%;
		margin:auto;
		margin-bottom: 1rem;
	}

	.menu-title {
		font-size: 0.9rem;
		color: #26201a;
		flex-grow: 1; /* タイトルの高さが揃うように調整 */
		line-height: 34px;
		text-align: center;
	}

	.menu-price-container {
		display: flex;
		flex-direction: row;
		justify-content: flex-end;
	}

	.menu-price {
		font-size: 0.8rem;
	}
</style>
