<!-- 屋台登録ページ（屋台提供者用） -->
<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';
	import { createStallSpec, getMyProfile, uploadImage } from '$lib/db.js';

	let mapContainer = $state();
	let isLoading = $state(true);
	let isSaving = $state(false);
	let errorMessage = $state('');
	let successMessage = $state('');
	let userId = $state('');
	let pickerMarker = null;

	// フォームデータ
	let stallName = $state('');
	let specs = $state('');
	let rentalFee = $state('');
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

		// 屋台提供者権限チェック
		const profile = await getMyProfile(userId);
		if (!profile?.operators) {
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
		if (!stallName.trim()) { errorMessage = '屋台名を入力してください'; return; }
		if (lat === null || lng === null) { errorMessage = '地図上で屋台の現在地をタップしてください'; return; }

		isSaving = true;
		try {
			let photoPath = null;
			if (photoFile) {
				photoPath = await uploadImage(userId, photoFile, 'stall-images');
			}
			await createStallSpec(userId, {
				stall_name: stallName.trim(),
				specs: specs.trim() || null,
				rental_fee: rentalFee ? parseInt(rentalFee) : 0,
				lat,
				lng,
				photo_path: photoPath
			});
			successMessage = '屋台を登録しました！';
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
		<h2>屋台を登録</h2>
	</div>

	{#if isLoading}
		<p class="loading">読み込み中…</p>
	{:else}
		<!-- 地図ピン設定 -->
		<div class="map-section">
			<p class="map-instruction">
				🏮 地図をタップして屋台の現在地を指定してください
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
				<p class="field-label-text">屋台の写真</p>
				{#if photoPreview}
					<img src={photoPreview} alt="屋台写真" class="photo-preview" />
				{:else}
					<label class="photo-upload-label" for="stall-photo">
						<div class="photo-placeholder">📷 写真を追加</div>
					</label>
				{/if}
				<input id="stall-photo" type="file" accept="image/*" class="hidden-file" onchange={onPhotoChange} />
			</div>

			<label class="field-label">
				屋台名 <span class="req">*</span>
				<input type="text" bind:value={stallName} class="field-input" placeholder="例: 鴨川珈琲 壱号台" required />
			</label>

			<label class="field-label">
				屋台スペック
				<textarea
					bind:value={specs}
					class="field-input textarea"
					rows="3"
					placeholder="例: 幅1.8m / 電源あり / 提灯付き / 最大3名で運営可"
				></textarea>
			</label>

			<label class="field-label">
				レンタル料金（円 / 日）
				<input type="number" bind:value={rentalFee} class="field-input" placeholder="2500" min="0" />
			</label>

			<button type="submit" class="submit-btn" disabled={isSaving || lat === null}>
				{isSaving ? '登録中…' : '🏮 屋台を登録する'}
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

	.page-header { margin-bottom: 20px; }

	.back-link {
		display: inline-block; font-size: 0.85rem;
		color: #64748b; text-decoration: none; margin-bottom: 8px;
	}

	.page-header h2 { font-size: 1.3rem; color: #0f172a; margin: 0; }

	.loading { color: #64748b; text-align: center; padding: 40px; }

	.map-section { margin-bottom: 24px; }

	.map-instruction { font-size: 0.85rem; color: #475569; margin-bottom: 8px; }

	.coords {
		font-family: monospace; background: #f1f5f9;
		padding: 2px 6px; border-radius: 4px;
		font-size: 0.8rem; color: #92400e;
	}

	.map-container {
		width: 100%; height: 260px;
		border-radius: 12px; overflow: hidden;
		border: 2px solid #e2e8f0;
	}

	.form { display: flex; flex-direction: column; gap: 4px; }

	.error-msg {
		background: #fee2e2; color: #dc2626;
		border-radius: 8px; padding: 10px 14px; font-size: 0.85rem;
	}

	.success-msg {
		background: #dcfce7; color: #166534;
		border-radius: 8px; padding: 10px 14px; font-size: 0.85rem;
	}

	.field-label { display: block; font-size: 0.85rem; color: #475569; margin-bottom: 12px; }

	.req { color: #ef4444; }

	.field-input {
		display: block; width: 100%; margin-top: 5px;
		padding: 10px 12px; border: 1.5px solid #e2e8f0;
		border-radius: 8px; font-size: 0.95rem;
		font-family: inherit; box-sizing: border-box;
	}

	.field-input:focus { outline: none; border-color: #facc15; }
	.textarea { resize: vertical; min-height: 80px; }

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
