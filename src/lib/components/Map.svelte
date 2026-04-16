<script>
	import { onMount } from 'svelte';
	import { importLibrary } from '@googlemaps/js-api-loader';
	import { fly } from 'svelte/transition';

	let { spaces = [], mapId } = $props(); // Svelte 5のprops取得方法
	let mapContainer;
	let selectedSpace = $state(null); // Svelte 5のステート管理
	let mapInstance;

	onMount(async () => {
		try {
			const { Map } = await importLibrary('maps');
			const { AdvancedMarkerElement } = await importLibrary('marker');

			mapInstance = new Map(mapContainer, {
				center: { lat: 35.009, lng: 135.772 },
				zoom: 15,
				disableDefaultUI: false,
				clickableIcons: false,
				mapId: mapId // 親コンポーネントから渡されたIDを使用
			});

			spaces.forEach((space) => {
				const marker = new AdvancedMarkerElement({
					map: mapInstance,
					position: { lat: space.lat, lng: space.lng },
					title: space.name
				});

				marker.content.addEventListener('click', () => {
					selectedSpace = space;
					if(mapInstance) {
						mapInstance.panTo(marker.position);
					}
				});
			});

			mapInstance.addListener('click', (e) => {
				// マーカーのクリックイベントがマップに伝播しないようにする
				if (e.target instanceof HTMLElement && e.target.closest('gmp-advanced-marker')) {
      				return;
    			}
				selectedSpace = null;
			});
		} catch (error) {
			console.error('Google Maps Load Error:', error);
		}
	});

	function closeDetail() {
		selectedSpace = null;
	}

	function handleReserve() {
		if (selectedSpace) {
			alert(`「${selectedSpace.name}」の予約画面へ進みます。`);
		}
	}
</script>

<div class="map-wrapper-inner">
	<div class="map-canvas" bind:this={mapContainer}></div>

	{#if selectedSpace}
		<div class="detail-panel" transition:fly={{ y: 200, duration: 300 }}>
			<button class="close-btn" onclick={closeDetail}>×</button>
			
			<div class="panel-content">
				<div class="panel-image" style="background-image: url({selectedSpace.image});"></div>
				<div class="panel-info">
					<span class="badge {selectedSpace.type}">
						{selectedSpace.type === 'garage' ? '屋台ガレージ' : '出店スペース'}
					</span>
					<h3>{selectedSpace.name}</h3>
					<p class="description">{selectedSpace.description}</p>
					<p class="price">¥{selectedSpace.price.toLocaleString()} <span class="unit">/ 泊</span></p>
					
					<button class="reserve-btn" onclick={handleReserve}>
						詳細・予約へ
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.map-wrapper-inner {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		border-radius: 16px;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
	}

	.map-canvas {
		width: 100%;
		height: 100%;
	}

	.detail-panel {
		position: absolute;
		bottom: 20px;
		left: 20px;
		right: 20px;
		background: white;
		border-radius: 20px;
		padding: 20px;
		box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
		z-index: 50;
		max-width: 500px;
		margin: 0 auto;
	}

	.close-btn {
		position: absolute;
		top: 10px;
		right: 15px;
		background: none;
		border: none;
		font-size: 28px;
		color: #cbd5e1;
		cursor: pointer;
	}

	.panel-content {
		display: flex;
		gap: 20px;
	}

	.panel-image {
		width: 100px;
		height: 100px;
		border-radius: 12px;
		background-size: cover;
		background-position: center;
		flex-shrink: 0;
	}

	.panel-info {
		flex: 1;
	}

	h3 {
		margin: 5px 0;
		font-size: 1.1rem;
		color: #0f172a;
	}

	.description {
		font-size: 0.85rem;
		color: #64748b;
		margin-bottom: 10px;
	}

	.price {
		font-size: 1.1rem;
		font-weight: bold;
		margin-bottom: 10px;
	}

	.badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 0.7rem;
		font-weight: bold;
	}

	.badge.parking { background: #dbeafe; color: #1e40af; }
	.badge.storefront { background: #dcfce7; color: #166534; }
	.badge.garage { background: #fef9c3; color: #854d0e; }

	.reserve-btn {
		background: #facc15;
		color: #0f172a;
		border: none;
		padding: 8px;
		border-radius: 8px;
		font-weight: bold;
		width: 100%;
		cursor: pointer;
	}

	@media (max-width: 480px) {
		.panel-content { flex-direction: column; }
		.panel-image { width: 100%; height: 80px; }
	}
</style>
