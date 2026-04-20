<!-- スペース登録ページ（場所提供者用） -->
<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';
	import { createRentalSpace, getMyProfile, uploadImage } from '$lib/db.js';

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
	let photoFile = $state(null);
	let photoPreview = $state('');

	onMount(async () => {
		const {
			data: { session }
		} = await supabase.auth.getSession();
		if (!session) { goto(`${base}/auth`); return; }
		userId = session.user.id;

		// 場所提供者権限チェック
		const profile = await getMyProfile(userId);
		if (!profile?.owners) {
			goto(`${base}/mypage`);
			return;
		}

		isLoading = false;
		await initMap();
	});

	async function initMap() {
		try {
			const L = (await import('leaflet')).default;
			const map = L.map(mapContainer, { center: [35.009, 135.772], zoom: 15 });
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
				maxZoom: 19,
			}).addTo(map);

			// クリックでピンを設置
			map.on('click', (e) => {
				lat = parseFloat(e.latlng.lat.toFixed(6));
				lng = parseFloat(e.latlng.lng.toFixed(6));
				if (pickerMarker) pickerMarker.remove();
				pickerMarker = L.marker([lat, lng]).addTo(map);
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

	async function handleSubmit() {
		errorMessage = '';
		if (!name.trim()) { errorMessage = 'スペース名を入力してください'; return; }
		if (lat === null || lng === null) { errorMessage = '地図上でスペースの位置をタップしてください'; return; }

		isSaving = true;
		try {
			let photosPath = [];
			if (photoFile) {
				const url = await uploadImage(userId, photoFile, 'space-images');
				photosPath = [url];
			}
			await createRentalSpace(userId, {
				name: name.trim(),
				address: address.trim() || null,
				lat,
				lng,
				space_fee: spaceFee ? parseInt(spaceFee) : 0,
				ground_type: groundType.trim() || null,
				area_category: areaCategory.trim() || null,
				fire_use_allowed: fireUseAllowed,
				max_stalls: maxStalls ? parseInt(maxStalls) : 1,
				capacity: capacity ? parseInt(capacity) : 10,
				status: 'available',
				photos_path: photosPath.length > 0 ? photosPath : null
			});
			successMessage = 'スペースを登録しました！';
			setTimeout(() => goto(`${base}/mypage`), 1500);
		} catch (e) {
			errorMessage = '登録に失敗しました: ' + e.message;
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="page">
	<div class="page-header">
		<a href="{base}/mypage" class="back-link">← マイページ</a>
		<h2>スペースを登録</h2>
	</div>

	{#if isLoading}
		<p class="loading">読み込み中…</p>
	{:else}
		<!-- 地図ピン設定 -->
		<div class="map-section">
			<p class="map-instruction">
				📍 地図をタップして場所を指定してください
				{#if lat !== null}
					<span class="coords">({lat}, {lng})</span>
				{/if}
			</p>
			<div class="map-container" bind:this={mapContainer}></div>
		</div>

		<!-- フォーム -->
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
					<img src={photoPreview} alt="スペース写真" class="photo-preview" />
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
				貸出可能台数（屋台の最大同時出店数）
				<input type="number" bind:value={maxStalls} class="field-input" placeholder="1" min="1" />
			</label>

			<label class="field-label">
				利用可能人数（スペースの最大収容人数）
				<input type="number" bind:value={capacity} class="field-input" placeholder="10" min="1" />
			</label>

			<label class="checkbox-label">
				<input type="checkbox" bind:checked={fireUseAllowed} class="checkbox" />
				火気使用可
			</label>

			<button type="submit" class="submit-btn" disabled={isSaving || lat === null}>
				{isSaving ? '登録中…' : '📍 スペースを登録する'}
			</button>
		</form>
	{/if}
</div>

<style>
	.page {
		max-width: 600px;
		margin: 0 auto;
		padding: 20px 16px 60px;
	}

	.page-header {
		margin-bottom: 20px;
	}

	.back-link {
		display: inline-block;
		font-size: 0.85rem;
		color: #64748b;
		text-decoration: none;
		margin-bottom: 8px;
	}

	.page-header h2 {
		font-size: 1.3rem;
		color: #0f172a;
		margin: 0;
	}

	.loading { color: #64748b; text-align: center; padding: 40px; }

	/* 地図 */
	.map-section { margin-bottom: 24px; }

	.map-instruction {
		font-size: 0.85rem;
		color: #475569;
		margin-bottom: 8px;
	}

	.coords {
		font-family: monospace;
		background: #f1f5f9;
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 0.8rem;
		color: #166534;
	}

	.map-container {
		width: 100%;
		height: 260px;
		border-radius: 12px;
		overflow: hidden;
		border: 2px solid #e2e8f0;
	}

	/* フォーム */
	.form { display: flex; flex-direction: column; gap: 4px; }

	.error-msg {
		background: #fee2e2; color: #dc2626;
		border-radius: 8px; padding: 10px 14px; font-size: 0.85rem;
	}

	.success-msg {
		background: #dcfce7; color: #166534;
		border-radius: 8px; padding: 10px 14px; font-size: 0.85rem;
	}

	.field-label {
		display: block; font-size: 0.85rem; color: #475569; margin-bottom: 12px;
	}

	.req { color: #ef4444; }

	.field-input {
		display: block; width: 100%; margin-top: 5px;
		padding: 10px 12px; border: 1.5px solid #e2e8f0;
		border-radius: 8px; font-size: 0.95rem; box-sizing: border-box;
	}

	.field-input:focus { outline: none; border-color: #facc15; }

	.checkbox-label {
		display: flex; align-items: center; gap: 10px;
		font-size: 0.9rem; color: #334155; margin-bottom: 16px;
		cursor: pointer;
	}

	.checkbox { width: 18px; height: 18px; cursor: pointer; accent-color: #facc15; }

	.submit-btn {
		width: 100%; padding: 14px;
		background: #facc15; color: #0f172a;
		border: none; border-radius: 10px;
		font-size: 1rem; font-weight: bold;
		cursor: pointer; margin-top: 8px;
	}

	.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

	.photo-section { margin-bottom: 16px; }
	.field-label-text { font-size: 0.85rem; color: #475569; margin-bottom: 8px; }
	.photo-preview { width: 100%; max-height: 200px; object-fit: cover; border-radius: 10px; border: 1.5px solid #e2e8f0; display: block; }
	.photo-upload-label { cursor: pointer; display: block; }
	.photo-placeholder {
		width: 100%; height: 120px;
		background: #f1f5f9; border: 2px dashed #cbd5e1;
		border-radius: 10px; display: flex;
		align-items: center; justify-content: center;
		font-size: 0.9rem; color: #94a3b8;
	}
	.hidden-file { display: none; }
</style>
