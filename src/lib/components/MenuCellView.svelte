<script>
	import { base } from '$app/paths';

	let { menuItem } = $props();

	let isOpen = $state(false);

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
			<button
				class="menu-image-btn"
				onclick={() => (isOpen = true)}
				aria-label="{menuItem.name}の写真を拡大"
			>
				<img class="menu-image" src={base + menuItem.image} alt={menuItem.name} />
			</button>
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

{#if isOpen}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="lightbox"
		role="dialog"
		aria-modal="true"
		aria-label="{menuItem.name}の写真"
		onclick={() => (isOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (isOpen = false)}
		tabindex="-1"
	>
		<button class="lightbox-close" onclick={() => (isOpen = false)} aria-label="閉じる">×</button>
		<img
			class="lightbox-img"
			src={base + menuItem.image}
			alt={menuItem.name}
		/>
		<p class="lightbox-caption">
			<span class="lightbox-name">{@html menuItem.name}</span>
			<span class="lightbox-price">{formatMenuPrice(menuItem.price)}</span>
		</p>
	</div>
{/if}

<style>
	.menu-cell-container {
		width: 100%;
		box-sizing: border-box;
	}

	.menu-image-container {
		width: 100%;
		margin-bottom: 0.5rem;
		aspect-ratio: 3 / 4;
	}

	.menu-image-btn {
		width: 100%;
		height: 100%;
		padding: 0;
		border: none;
		background: none;
		cursor: zoom-in;
		display: block;
	}

	.menu-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
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
		margin-bottom: 1rem;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 4px;
		padding: 0 2px;
		box-sizing: border-box;
	}

	.menu-title {
		font-size: 0.78rem;
		color: #26201a;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
		min-width: 0;
	}

	.menu-price-container {
		flex-shrink: 0;
	}

	.menu-price {
		font-size: 0.78rem;
		white-space: nowrap;
		color: #26201a;
		font-weight: 600;
	}

	/* ライトボックス */
	.lightbox {
		position: fixed;
		inset: 0;
		z-index: 9999;
		background: rgba(0, 0, 0, 0.88);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 20px;
		box-sizing: border-box;
	}

	.lightbox-close {
		position: fixed;
		top: 16px;
		right: 16px;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: none;
		background: rgba(255, 255, 255, 0.2);
		color: #fff;
		font-size: 1.4rem;
		line-height: 1;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10000;
	}

	.lightbox-img {
		max-width: 100%;
		max-height: 75svh;
		border-radius: 12px;
		object-fit: contain;
		display: block;
	}

	.lightbox-caption {
		margin-top: 16px;
		display: flex;
		gap: 16px;
		align-items: baseline;
		color: #fff;
	}

	.lightbox-name {
		font-size: 1rem;
		font-weight: 600;
	}

	.lightbox-price {
		font-size: 0.9rem;
		opacity: 0.8;
	}
</style>
