<!-- スペース編集ページ（場所提供者用） -->
<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
	import { supabase } from '$lib/supabase.js';
	import { getMyProfile, updateRentalSpace, uploadImage } from '$lib/db.js';

	const spaceId = $derived($page.params.id);

	let mapContainer = $state();
	let isLoading = $state(true);
	let isSaving = $state(false);
	let errorMessage = $state('');
	let successMessage = $state('');
	let userId = $state('');
	let pickerMarker = null;

	// フォームデータ
	let name = $state('');
	let address = $state('');
	let spaceFee = $state('');
	let groundType = $state('');
	let areaCategory = $state('');
	let fireUseAllowed = $state(false);
	let maxStalls = $state(1);
	let capacity = $state(10);
	let lat = $state(null);
	let lng = $state(null);

	// 写真
	let photoFile = $state(null);
	let photoPreview = $state('');
	let existingPhotos = $state([]);

	onMount(async () => {
		const { data: { session } } = await supabase.auth.getSession();
		if (!session) { goto(`${base}/auth`); return; }
		userId = session.user.id;

		const profile = await getMyProfile(userId);
		if (!profile?.owners) { goto(`${base}/mypage`); return; }

		// スペースデータを取得
		const { data: space, error } = await supabase
			.from('rental_spaces')
			.select('*')
			.eq('id', spaceId)
			.eq('user_id', userId)
			.single();

		if (error || !space) {
			goto(`${base}/mypage`);
			return;
		}

		// フォームに初期値をセット
		name = space.name ?? '';
		address = space.address ?? '';
		spaceFee = space.space_fee?.toString() ?? '';
		groundType = space.ground_type ?? '';
		areaCategory = space.area_category ?? '';
		fireUseAllowed = space.fire_use_allowed ?? false;
		maxStalls = space.max_stalls ?? 1;
		capacity = space.capacity ?? 10;
		lat = space.lat ?? null;
		lng = space.lng ?? null;
		existingPhotos = space.photos_path ?? [];
		if (existingPhotos.length > 0) photoPreview = existingPhotos[0];

		isLoading = false;
		await initMap();
	});

	async function initMap() {
		try {
			setOptions({
				apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
				version: 'weekly',
				libraries: ['maps', 'marker']
			});
			const { Map } = await importLibrary('maps');
			const { AdvancedMarkerElement } = await importLibrary('marker');

			const center = lat !== null ? { lat, lng } : { lat: 35.009, lng: 135.772 };
			const map = new Map(mapContainer, {
				center,
				zoom: 15,
				mapId: 'dc1ab66880d245ef156be95a'
			});

			// 既存位置にピンを表示
			if (lat !== null) {
				pickerMarker = new AdvancedMarkerElement({ map, position: { lat, lng } });
			}

			map.addListener('click', (e) => {
				lat = parseFloat(e.latLng.lat().toFixed(6));
				lng = parseFloat(e.latLng.lng().toFixed(6));
				if (pickerMarker) pickerMarker.setMap(null);
				pickerMarker = new AdvancedMarkerElement({ map, position: { lat, lng } });
			});
		} catch (e) {
			console.error('Map init error:', e);
		}
	}

	function onPhotoChange(e) {
		const file = e.target.files?.[0];
		if (!file) return;
		photoFile = file;
		photoPreview = URL.createObjectURL(file);
	}

	function removePhoto() {
		photoFile = null;
		photoPreview = '';
		existingPhotos = [];
	}

	async function handleSubmit() {
		errorMessage = '';
		if (!name.trim()) { errorMessage = 'スペース名を入力してください'; return; }
		if (lat === null || lng === null) { errorMessage = '地図上でスペースの位置をタップしてください'; return; }

		isSaving = true;
		try {
			let photosPath = existingPhotos;
			if (photoFile) {
				const url = await uploadImage(userId, photoFile, 'space-images');
				photosPath = [url];
			} else if (photoPreview === '') {
				photosPath = [];
			}

			await updateRentalSpace(spaceId, {
				name: name.trim(),
				address: address.trim() || null,
				spaceFee: spaceFee ? parseInt(spaceFee) : 0,
				groundType: groundType.trim() || null,
				areaCategory: areaCategory.trim() || null,
				fireUseAllowed,
				maxStalls: maxStalls ? parseInt(maxStalls) : 1,
				capacity: capacity ? parseInt(capacity) : 10,
				photosPath
			});
			successMessage = '変更を保存しました！';
			setTimeout(() => goto(`${base}/mypage`), 1200);
		} catch (e) {
			errorMessage = '保存に失敗しました: ' + e.message;
		} finally {
			isSaving = false;
		}
	}
</script>

<svelte:head>
	<title>スペースを編集 | 微小夜行電灯</title>
</svelte:head>

<div class="page">
	<div class="page-header">
		<a href="{base}/mypage" class="back-link">← マイページ</a>
		<h2>スペースを編集</h2>
	</div>

	{#if isLoading}
		<p class="loading">読み込み中…</p>
	{:else}
		<!-- 地図ピン設定 -->
		<div class="map-section">
			<p class="map-instruction">
				📍 地図をタップして場所を指定
				{#if lat !== null}
					<span class="coords">({lat}, {lng})</span>
				{/if}
			</p>
			<div class="map-container" bind:this={mapContainer}></div>
		</div>

		<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="form">
			{#if errorMessage}
				<p class="error-msg">{errorMessage}</p>
			{/if}
			{#if successMessage}
				<p class="success-msg">✓ {successMessage}</p>
			{/if}

			<!-- 写真アップロード -->
			<div class="photo-section">
				<p class="field-label-text">スペース写真</p>
				{#if photoPreview}
					<div class="photo-preview-wrap">
						<img src={photoPreview} alt="スペース写真" class="photo-preview" />
						<button type="button" class="photo-remove-btn" onclick={removePhoto}>× 削除</button>
					</div>
				{:else}
					<label class="photo-upload-label" for="space-photo">
						<div class="photo-placeholder">📷 写真を追加</div>
					</label>
				{/if}
				<input id="space-photo" type="file" accept="image/*" class="hidden-file" onchange={onPhotoChange} />
			</div>

			<label class="field-label">
				スペース名 <span class="req">*</span>
				<input type="text" bind:value={name} class="field-input" placeholder="例: 鴨川河川敷スペースA" required />
			</label>

			<label class="field-label">
				住所
				<input type="text" bind:value={address} class="field-input" placeholder="例: 京都市左京区..." />
			</label>

			<label class="field-label">
				場所代（円 / 泊）
				<input type="number" bind:value={spaceFee} class="field-input" placeholder="3000" min="0" />
			</label>

			<label class="field-label">
				エリア区分
				<input type="text" bind:value={areaCategory} class="field-input" placeholder="例: 鴨川沿い、河川敷" />
			</label>

			<label class="field-label">
				地面の種類
				<input type="text" bind:value={groundType} class="field-input" placeholder="例: 芝生、砂利、アスファルト" />
			</label>

			<label class="field-label">
				貸出可能台数
				<input type="number" bind:value={maxStalls} class="field-input" placeholder="1" min="1" />
			</label>

			<label class="field-label">
				利用可能人数
				<input type="number" bind:value={capacity} class="field-input" placeholder="10" min="1" />
			</label>

			<label class="checkbox-label">
				<input type="checkbox" bind:checked={fireUseAllowed} class="checkbox" />
				火気使用可
			</label>

			<button type="submit" class="submit-btn" disabled={isSaving || lat === null}>
				{isSaving ? '保存中…' : '✓ 変更を保存する'}
			</button>
		</form>
	{/if}
</div>

<style>
	.page { max-width: 600px; margin: 0 auto; padding: 20px 16px 60px; }
	.page-header { margin-bottom: 20px; }
	.back-link { display: inline-block; font-size: 0.85rem; color: #64748b; text-decoration: none; margin-bottom: 8px; }
	.page-header h2 { font-size: 1.3rem; color: #0f172a; margin: 0; }
	.loading { color: #64748b; text-align: center; padding: 40px; }

	.map-section { margin-bottom: 24px; }
	.map-instruction { font-size: 0.85rem; color: #475569; margin-bottom: 8px; }
	.coords { font-family: monospace; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; color: #166534; }
	.map-container { width: 100%; height: 260px; border-radius: 12px; overflow: hidden; border: 2px solid #e2e8f0; }

	.form { display: flex; flex-direction: column; gap: 4px; }
	.error-msg { background: #fee2e2; color: #dc2626; border-radius: 8px; padding: 10px 14px; font-size: 0.85rem; }
	.success-msg { background: #dcfce7; color: #166534; border-radius: 8px; padding: 10px 14px; font-size: 0.85rem; }

	/* 写真 */
	.photo-section { margin-bottom: 16px; }
	.field-label-text { font-size: 0.85rem; color: #475569; margin-bottom: 8px; }
	.photo-preview-wrap { position: relative; display: inline-block; }
	.photo-preview { width: 100%; max-height: 200px; object-fit: cover; border-radius: 10px; border: 1.5px solid #e2e8f0; display: block; }
	.photo-remove-btn {
		position: absolute; top: 8px; right: 8px;
		background: rgba(0,0,0,0.55); color: white;
		border: none; border-radius: 6px;
		font-size: 0.8rem; padding: 4px 10px; cursor: pointer;
	}
	.photo-upload-label { cursor: pointer; display: block; }
	.photo-placeholder {
		width: 100%; height: 120px;
		background: #f1f5f9; border: 2px dashed #cbd5e1;
		border-radius: 10px; display: flex;
		align-items: center; justify-content: center;
		font-size: 0.9rem; color: #94a3b8;
	}
	.hidden-file { display: none; }

	.field-label { display: block; font-size: 0.85rem; color: #475569; margin-bottom: 12px; }
	.req { color: #ef4444; }
	.field-input {
		display: block; width: 100%; margin-top: 5px;
		padding: 10px 12px; border: 1.5px solid #e2e8f0;
		border-radius: 8px; font-size: 0.95rem; box-sizing: border-box;
	}
	.field-input:focus { outline: none; border-color: #facc15; }
	.checkbox-label { display: flex; align-items: center; gap: 10px; font-size: 0.9rem; color: #334155; margin-bottom: 16px; cursor: pointer; }
	.checkbox { width: 18px; height: 18px; cursor: pointer; accent-color: #facc15; }
	.submit-btn {
		width: 100%; padding: 14px;
		background: #facc15; color: #0f172a;
		border: none; border-radius: 10px;
		font-size: 1rem; font-weight: bold; cursor: pointer; margin-top: 8px;
	}
	.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
