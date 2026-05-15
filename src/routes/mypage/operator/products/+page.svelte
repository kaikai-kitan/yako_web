<svelte:head>
	<title>商品管理 | 出店者ダッシュボード</title>
</svelte:head>

<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';

	const MAX_PHOTOS = 5;
	const CATEGORIES = ['', 'フード', 'ドリンク', '屋台（Stall）', '雑貨（Goods）', 'アート', 'その他'];

	let userId = $state(null);
	let products = $state([]);
	let isLoading = $state(true);
	let msg = $state('');
	let errMsg = $state('');
	let backHref = $state(`${base}/mypage`);
	let backLabel = $state('マイページ');

	// 追加フォーム
	let showAddForm = $state(false);
	let isSubmitting = $state(false);
	let newProduct = $state({ name: '', description: '', price: '', stock: '', category: '' });
	let newTags = $state([]);
	let newTagInput = $state('');
	let newPhotoFiles = $state([]);
	let newPhotoPreviews = $state([]);

	// 編集
	let editingId = $state(null);
	let editProduct = $state({});
	let editTags = $state([]);
	let editTagInput = $state('');
	let editExistingUrls = $state([]);
	let editNewFiles = $state([]);
	let editNewPreviews = $state([]);
	let isSaving = $state(false);

	// プレビューモーダル
	let previewModal = $state(null);

	onMount(async () => {
		if (typeof document !== 'undefined') {
			const ref = document.referrer;
			if (ref && ref.includes('/shop') && !ref.includes('/operator')) {
				backHref = `${base}/shop`;
				backLabel = 'オンラインショップ';
			}
		}

		const { data: { session } } = await supabase.auth.getSession();
		if (!session) { goto(`${base}/auth`); return; }
		userId = session.user.id;
		await loadProducts();
	});

	async function loadProducts() {
		isLoading = true;
		const { data, error } = await supabase
			.from('shop_products')
			.select('*')
			.eq('operator_id', userId)
			.order('display_order', { ascending: true })
			.order('created_at', { ascending: false });
		if (error) { errMsg = '商品の読み込みに失敗しました'; }
		else { products = data ?? []; }
		isLoading = false;
	}

	// --- タグ ---
	function addTag(mode) {
		const raw = mode === 'new' ? newTagInput : editTagInput;
		const val = raw.trim();
		if (!val) return;
		if (mode === 'new') {
			if (!newTags.includes(val)) newTags = [...newTags, val];
			newTagInput = '';
		} else {
			if (!editTags.includes(val)) editTags = [...editTags, val];
			editTagInput = '';
		}
	}

	function removeTag(mode, index) {
		if (mode === 'new') newTags = newTags.filter((_, i) => i !== index);
		else editTags = editTags.filter((_, i) => i !== index);
	}

	function handleTagKeydown(e, mode) {
		if (e.key === 'Enter') { e.preventDefault(); addTag(mode); }
	}

	// --- 写真 ---
	function handlePhotosChange(e, mode) {
		const files = Array.from(e.target.files ?? []);
		if (mode === 'new') {
			const remaining = MAX_PHOTOS - newPhotoFiles.length;
			const toAdd = files.slice(0, remaining);
			newPhotoFiles = [...newPhotoFiles, ...toAdd];
			newPhotoPreviews = [...newPhotoPreviews, ...toAdd.map(f => URL.createObjectURL(f))];
		} else {
			const remaining = MAX_PHOTOS - editExistingUrls.length - editNewFiles.length;
			const toAdd = files.slice(0, remaining);
			editNewFiles = [...editNewFiles, ...toAdd];
			editNewPreviews = [...editNewPreviews, ...toAdd.map(f => URL.createObjectURL(f))];
		}
		e.target.value = '';
	}

	function removeNewPhoto(mode, index) {
		if (mode === 'new') {
			URL.revokeObjectURL(newPhotoPreviews[index]);
			newPhotoFiles = newPhotoFiles.filter((_, i) => i !== index);
			newPhotoPreviews = newPhotoPreviews.filter((_, i) => i !== index);
		} else {
			URL.revokeObjectURL(editNewPreviews[index]);
			editNewFiles = editNewFiles.filter((_, i) => i !== index);
			editNewPreviews = editNewPreviews.filter((_, i) => i !== index);
		}
	}

	function removeExistingPhoto(index) {
		editExistingUrls = editExistingUrls.filter((_, i) => i !== index);
	}

	// --- アップロード ---
	async function uploadPhoto(file) {
		const ext = file.name.split('.').pop().toLowerCase();
		const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
		const { error } = await supabase.storage.from('shop-images').upload(path, file, { upsert: false });
		if (error) throw new Error('画像のアップロードに失敗しました: ' + error.message);
		const { data } = supabase.storage.from('shop-images').getPublicUrl(path);
		return data.publicUrl;
	}

	async function uploadAllPhotos(files) {
		const urls = [];
		for (const f of files) { urls.push(await uploadPhoto(f)); }
		return urls;
	}

	// --- CRUD ---
	async function addProduct() {
		if (!newProduct.name.trim() || !newProduct.price) {
			errMsg = '商品名と価格は必須です';
			return;
		}
		isSubmitting = true;
		errMsg = '';
		try {
			const photoUrls = newPhotoFiles.length > 0 ? await uploadAllPhotos(newPhotoFiles) : [];
			const { error } = await supabase.from('shop_products').insert({
				operator_id: userId,
				name: newProduct.name.trim(),
				description: newProduct.description.trim() || null,
				price: parseInt(newProduct.price, 10),
				stock: newProduct.stock !== '' ? parseInt(newProduct.stock, 10) : null,
				category: newProduct.category || null,
				tags: newTags.length ? newTags : null,
				photo_url: photoUrls[0] ?? null,
				photo_urls: photoUrls.length ? photoUrls : null,
				is_active: true,
				display_order: products.length
			});
			if (error) throw new Error(error.message);

			msg = '商品を追加しました';
			showAddForm = false;
			newProduct = { name: '', description: '', price: '', stock: '', category: '' };
			newTags = [];
			newTagInput = '';
			newPhotoFiles = [];
			newPhotoPreviews = [];
			await loadProducts();
			setTimeout(() => (msg = ''), 3000);
		} catch (e) {
			errMsg = e.message;
		}
		isSubmitting = false;
	}

	function startEdit(product) {
		editingId = product.id;
		editProduct = {
			name: product.name,
			description: product.description ?? '',
			price: String(product.price),
			stock: product.stock !== null ? String(product.stock) : '',
			category: product.category ?? ''
		};
		editTags = [...(product.tags ?? [])];
		editTagInput = '';
		editExistingUrls = [...(product.photo_urls ?? (product.photo_url ? [product.photo_url] : []))];
		editNewFiles = [];
		editNewPreviews = [];
	}

	function cancelEdit() {
		editingId = null;
		editNewFiles = [];
		editNewPreviews = [];
	}

	async function saveEdit(productId) {
		if (!editProduct.name.trim() || !editProduct.price) {
			errMsg = '商品名と価格は必須です';
			return;
		}
		isSaving = true;
		errMsg = '';
		try {
			const newUploadedUrls = editNewFiles.length ? await uploadAllPhotos(editNewFiles) : [];
			const allUrls = [...editExistingUrls, ...newUploadedUrls];
			const { error } = await supabase.from('shop_products').update({
				name: editProduct.name.trim(),
				description: editProduct.description.trim() || null,
				price: parseInt(editProduct.price, 10),
				stock: editProduct.stock !== '' ? parseInt(editProduct.stock, 10) : null,
				category: editProduct.category || null,
				tags: editTags.length ? editTags : null,
				photo_url: allUrls[0] ?? null,
				photo_urls: allUrls.length ? allUrls : null
			}).eq('id', productId);
			if (error) throw new Error(error.message);

			msg = '保存しました';
			editingId = null;
			editNewFiles = [];
			editNewPreviews = [];
			await loadProducts();
			setTimeout(() => (msg = ''), 3000);
		} catch (e) {
			errMsg = e.message;
		}
		isSaving = false;
	}

	async function toggleActive(product) {
		const { error } = await supabase.from('shop_products')
			.update({ is_active: !product.is_active })
			.eq('id', product.id);
		if (!error) await loadProducts();
	}

	async function deleteProduct(productId) {
		if (!confirm('この商品を削除しますか？元に戻せません。')) return;
		const { error } = await supabase.from('shop_products').delete().eq('id', productId);
		if (error) { errMsg = '削除に失敗しました'; }
		else {
			msg = '削除しました';
			await loadProducts();
			setTimeout(() => (msg = ''), 3000);
		}
	}

	// --- プレビュー ---
	function openPreview(mode) {
		if (mode === 'new') {
			previewModal = {
				name: newProduct.name || '（名称未設定）',
				description: newProduct.description,
				price: parseInt(newProduct.price, 10) || 0,
				stock: newProduct.stock !== '' ? parseInt(newProduct.stock, 10) : null,
				category: newProduct.category,
				tags: newTags,
				photos: newPhotoPreviews
			};
		} else {
			previewModal = {
				name: editProduct.name || '（名称未設定）',
				description: editProduct.description,
				price: parseInt(editProduct.price, 10) || 0,
				stock: editProduct.stock !== '' ? parseInt(editProduct.stock, 10) : null,
				category: editProduct.category,
				tags: editTags,
				photos: [...editExistingUrls, ...editNewPreviews]
			};
		}
	}

	function getProductThumb(product) {
		return product.photo_urls?.[0] ?? product.photo_url ?? null;
	}
</script>

<!-- プレビューモーダル -->
{#if previewModal}
	<div class="modal-backdrop" onclick={() => (previewModal = null)} role="dialog" aria-modal="true">
		<div class="modal-box" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<span class="modal-label">プレビュー（お客様の見た目）</span>
				<button class="modal-close" onclick={() => (previewModal = null)}>✕</button>
			</div>
			<div class="preview-body">
				{#if previewModal.photos.length > 0}
					<div class="preview-photos">
						<img src={previewModal.photos[0]} alt={previewModal.name} class="preview-main-img" />
						{#if previewModal.photos.length > 1}
							<div class="preview-thumbs">
								{#each previewModal.photos as ph, i}
									<img src={ph} alt="" class="preview-thumb-sm" />
								{/each}
							</div>
						{/if}
					</div>
				{:else}
					<div class="preview-no-img">📷 写真なし</div>
				{/if}

				<div class="preview-info">
					{#if previewModal.category}
						<span class="preview-category">{previewModal.category}</span>
					{/if}
					<h2 class="preview-name">{previewModal.name}</h2>
					<p class="preview-price">¥{previewModal.price.toLocaleString()}</p>
					{#if previewModal.stock !== null}
						{#if previewModal.stock <= 0}
							<span class="preview-soldout">SOLD OUT</span>
						{:else if previewModal.stock <= 5}
							<span class="preview-stock-warn">残り {previewModal.stock} 点</span>
						{/if}
					{/if}
					{#if previewModal.description}
						<p class="preview-desc">{previewModal.description}</p>
					{/if}
					{#if previewModal.tags.length > 0}
						<div class="preview-tags">
							{#each previewModal.tags as tag}
								<span class="preview-tag">#{tag}</span>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<div class="page">
	<header class="top-bar">
		<a href={backHref} class="back-link">← {backLabel}</a>
		<h1 class="page-title">商品管理</h1>
		<button class="add-btn" onclick={() => { showAddForm = !showAddForm; errMsg = ''; }}>
			{showAddForm ? 'キャンセル' : '＋ 商品を追加'}
		</button>
	</header>

	{#if msg}
		<div class="toast success">{msg}</div>
	{/if}
	{#if errMsg}
		<div class="toast error">{errMsg}</div>
	{/if}

	<!-- 追加フォーム -->
	{#if showAddForm}
		<div class="form-card">
			<h2 class="form-title">新しい商品を追加</h2>

			<!-- 写真 -->
			<div class="field">
				<span class="label">商品写真 <small>（最大{MAX_PHOTOS}枚）</small></span>
				<div class="photo-grid">
					{#each newPhotoPreviews as prev, i}
						<div class="photo-cell">
							<img src={prev} alt="" class="photo-thumb" />
							<button class="photo-remove" onclick={() => removeNewPhoto('new', i)} aria-label="削除">✕</button>
						</div>
					{/each}
					{#if newPhotoFiles.length < MAX_PHOTOS}
						<label class="photo-add-btn">
							<span>＋ 追加</span>
							<input type="file" accept="image/*" multiple class="file-input"
								onchange={(e) => handlePhotosChange(e, 'new')} />
						</label>
					{/if}
				</div>
			</div>

			<label class="field">
				<span class="label required">商品名</span>
				<input class="input" type="text" bind:value={newProduct.name} placeholder="例: 手作りキャンドル" />
			</label>

			<label class="field">
				<span class="label">説明文</span>
				<textarea class="input textarea" bind:value={newProduct.description} placeholder="商品の説明を入力してください"></textarea>
			</label>

			<div class="row-fields">
				<label class="field">
					<span class="label required">価格（円）</span>
					<input class="input" type="number" min="0" bind:value={newProduct.price} placeholder="1000" />
				</label>
				<label class="field">
					<span class="label">在庫数 <small>（空欄=無制限）</small></span>
					<input class="input" type="number" min="0" bind:value={newProduct.stock} placeholder="10" />
				</label>
			</div>

			<label class="field">
				<span class="label">カテゴリ</span>
				<select class="input select" bind:value={newProduct.category}>
					{#each CATEGORIES as cat}
						<option value={cat}>{cat || '選択しない'}</option>
					{/each}
				</select>
			</label>

			<div class="field">
				<span class="label">タグ</span>
				<div class="tag-chips">
					{#each newTags as tag, i}
						<span class="chip">
							{tag}
							<button class="chip-remove" onclick={() => removeTag('new', i)} aria-label="タグを削除">✕</button>
						</span>
					{/each}
				</div>
				<div class="tag-input-row">
					<input class="input tag-input" type="text" bind:value={newTagInput}
						placeholder="例: ハンドメイド"
						onkeydown={(e) => handleTagKeydown(e, 'new')} />
					<button class="tag-add-btn" onclick={() => addTag('new')}>追加</button>
				</div>
			</div>

			<div class="form-actions">
				<button class="preview-btn" type="button" onclick={() => openPreview('new')}>プレビュー</button>
				<button class="submit-btn" onclick={addProduct} disabled={isSubmitting}>
					{isSubmitting ? '追加中…' : '商品を追加する'}
				</button>
			</div>
		</div>
	{/if}

	<!-- 商品一覧 -->
	<div class="product-list">
		{#if isLoading}
			<div class="loading">読み込み中…</div>
		{:else if products.length === 0}
			<div class="empty">
				<p>まだ商品がありません。</p>
				<p>「＋ 商品を追加」から最初の商品を登録してください。</p>
			</div>
		{:else}
			{#each products as product}
				<div class="product-item" class:inactive={!product.is_active}>
					{#if editingId === product.id}
						<!-- 編集モード -->
						<div class="edit-form">
							<!-- 写真 -->
							<div class="field">
								<span class="label">商品写真 <small>（最大{MAX_PHOTOS}枚）</small></span>
								<div class="photo-grid">
									{#each editExistingUrls as url, i}
										<div class="photo-cell">
											<img src={url} alt="" class="photo-thumb" />
											<button class="photo-remove" onclick={() => removeExistingPhoto(i)} aria-label="削除">✕</button>
										</div>
									{/each}
									{#each editNewPreviews as prev, i}
										<div class="photo-cell">
											<img src={prev} alt="" class="photo-thumb" />
											<button class="photo-remove" onclick={() => removeNewPhoto('edit', i)} aria-label="削除">✕</button>
										</div>
									{/each}
									{#if editExistingUrls.length + editNewFiles.length < MAX_PHOTOS}
										<label class="photo-add-btn">
											<span>＋ 追加</span>
											<input type="file" accept="image/*" multiple class="file-input"
												onchange={(e) => handlePhotosChange(e, 'edit')} />
										</label>
									{/if}
								</div>
							</div>

							<label class="field">
								<span class="label required">商品名</span>
								<input class="input" type="text" bind:value={editProduct.name} />
							</label>

							<label class="field">
								<span class="label">説明文</span>
								<textarea class="input textarea" bind:value={editProduct.description}></textarea>
							</label>

							<div class="row-fields">
								<label class="field">
									<span class="label required">価格（円）</span>
									<input class="input" type="number" min="0" bind:value={editProduct.price} />
								</label>
								<label class="field">
									<span class="label">在庫数 <small>（空欄=無制限）</small></span>
									<input class="input" type="number" min="0" bind:value={editProduct.stock} />
								</label>
							</div>

							<label class="field">
								<span class="label">カテゴリ</span>
								<select class="input select" bind:value={editProduct.category}>
									{#each CATEGORIES as cat}
										<option value={cat}>{cat || '選択しない'}</option>
									{/each}
								</select>
							</label>

							<div class="field">
								<span class="label">タグ</span>
								<div class="tag-chips">
									{#each editTags as tag, i}
										<span class="chip">
											{tag}
											<button class="chip-remove" onclick={() => removeTag('edit', i)} aria-label="タグを削除">✕</button>
										</span>
									{/each}
								</div>
								<div class="tag-input-row">
									<input class="input tag-input" type="text" bind:value={editTagInput}
										placeholder="例: ハンドメイド"
										onkeydown={(e) => handleTagKeydown(e, 'edit')} />
									<button class="tag-add-btn" onclick={() => addTag('edit')}>追加</button>
								</div>
							</div>

							<div class="edit-actions">
								<button class="preview-btn small" type="button" onclick={() => openPreview('edit')}>プレビュー</button>
								<button class="save-btn" onclick={() => saveEdit(product.id)} disabled={isSaving}>
									{isSaving ? '保存中…' : '保存する'}
								</button>
								<button class="cancel-btn" onclick={cancelEdit}>キャンセル</button>
							</div>
						</div>
					{:else}
						<!-- 表示モード -->
						<div class="product-row">
							<div class="product-thumb-wrap">
								{#if getProductThumb(product)}
									<img src={getProductThumb(product)} alt={product.name} class="product-thumb" />
								{:else}
									<div class="product-thumb no-img">🛍</div>
								{/if}
								{#if product.stock !== null && product.stock <= 0}
									<span class="soldout-badge">SOLD OUT</span>
								{/if}
								{#if (product.photo_urls?.length ?? 0) > 1}
									<span class="photo-count">+{product.photo_urls.length - 1}</span>
								{/if}
							</div>

							<div class="product-info">
								<p class="product-name">{product.name}</p>
								<p class="product-price">¥{product.price.toLocaleString()}</p>
								<p class="product-meta">
									在庫: {product.stock !== null ? `${product.stock}個` : '無制限'}
									{#if product.category} · {product.category}{/if}
								</p>
								{#if !product.is_active}
									<span class="inactive-badge">非公開</span>
								{/if}
							</div>

							<div class="product-actions">
								<button class="action-btn edit" onclick={() => startEdit(product)}>編集</button>
								<button class="action-btn toggle" onclick={() => toggleActive(product)}>
									{product.is_active ? '非公開' : '公開'}
								</button>
								<button class="action-btn delete" onclick={() => deleteProduct(product.id)}>削除</button>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.page {
		min-height: 100svh;
		background: #faf8f5;
		font-family: sans-serif;
		padding-bottom: 60px;
	}

	.top-bar {
		position: sticky; top: 0; z-index: 10;
		background: rgba(250,248,245,0.97);
		backdrop-filter: blur(8px);
		border-bottom: 1px solid #e8e0d8;
		display: flex; align-items: center; gap: 12px;
		padding: 12px 16px;
	}
	.back-link {
		font-size: 0.82rem; color: #7a6f67;
		text-decoration: none; flex-shrink: 0;
	}
	.back-link:hover { color: #26201a; }
	.page-title {
		flex: 1; font-size: 0.95rem; font-weight: 700;
		color: #26201a; margin: 0; text-align: center;
	}
	.add-btn {
		flex-shrink: 0;
		background: #26201a; color: white;
		border: none; border-radius: 8px;
		padding: 7px 12px; font-size: 0.8rem;
		font-family: inherit; cursor: pointer; white-space: nowrap;
	}

	.toast {
		margin: 12px 16px; padding: 10px 16px;
		border-radius: 10px; font-size: 0.88rem;
	}
	.toast.success { background: #ecfdf5; color: #166534; border: 1px solid #bbf7d0; }
	.toast.error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }

	.form-card {
		margin: 16px;
		background: white;
		border-radius: 16px;
		padding: 20px;
		box-shadow: 0 2px 12px rgba(0,0,0,0.06);
	}
	.form-title {
		font-size: 1rem; font-weight: 700; color: #26201a;
		margin: 0 0 16px;
	}

	.field {
		display: flex; flex-direction: column; gap: 5px;
		margin-bottom: 14px;
	}
	.label {
		font-size: 0.82rem; font-weight: 600; color: #5a5250;
	}
	.label.required::after { content: ' *'; color: #c62828; }
	small { font-weight: 400; color: #9e9289; }

	.input {
		border: 1.5px solid #e8e0d8; border-radius: 10px;
		padding: 9px 12px; font-size: 0.9rem;
		font-family: inherit; color: #26201a; outline: none;
		background: white; transition: border-color 0.15s;
	}
	.input:focus { border-color: #d56d04; }
	.textarea { min-height: 80px; resize: vertical; }
	.select { cursor: pointer; }

	.row-fields {
		display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
	}

	/* 写真グリッド */
	.photo-grid {
		display: flex; flex-wrap: wrap; gap: 8px;
	}
	.photo-cell {
		position: relative; width: 80px; height: 80px;
	}
	.photo-thumb {
		width: 80px; height: 80px; border-radius: 10px;
		object-fit: cover; display: block;
		border: 1.5px solid #e8e0d8;
	}
	.photo-remove {
		position: absolute; top: -6px; right: -6px;
		width: 20px; height: 20px;
		background: #26201a; color: white;
		border: none; border-radius: 50%;
		font-size: 0.6rem; cursor: pointer;
		display: flex; align-items: center; justify-content: center;
		line-height: 1;
	}
	.photo-add-btn {
		width: 80px; height: 80px;
		border: 2px dashed #d8d0c8; border-radius: 10px;
		display: flex; align-items: center; justify-content: center;
		cursor: pointer; font-size: 0.72rem; color: #9e9289;
		flex-direction: column; gap: 2px;
		transition: border-color 0.15s;
		position: relative;
	}
	.photo-add-btn:hover { border-color: #d56d04; color: #d56d04; }
	.file-input {
		position: absolute; inset: 0; opacity: 0; cursor: pointer;
		width: 100%; height: 100%;
	}

	/* タグ */
	.tag-chips {
		display: flex; flex-wrap: wrap; gap: 6px;
		min-height: 0;
	}
	.chip {
		display: inline-flex; align-items: center; gap: 4px;
		background: #f0ede8; color: #5a5250;
		border-radius: 20px; padding: 4px 10px;
		font-size: 0.8rem; font-weight: 500;
	}
	.chip-remove {
		background: none; border: none; cursor: pointer;
		font-size: 0.65rem; color: #9e9289;
		padding: 0; line-height: 1; margin-left: 2px;
	}
	.chip-remove:hover { color: #c62828; }
	.tag-input-row {
		display: flex; gap: 6px; margin-top: 4px;
	}
	.tag-input { flex: 1; }
	.tag-add-btn {
		padding: 9px 14px;
		background: #f0ede8; color: #5a5250;
		border: 1.5px solid #e8e0d8; border-radius: 10px;
		font-size: 0.82rem; font-family: inherit;
		cursor: pointer; white-space: nowrap; font-weight: 600;
	}
	.tag-add-btn:hover { background: #e8e0d8; }

	.form-actions {
		display: flex; gap: 8px; margin-top: 8px;
	}
	.submit-btn, .save-btn {
		flex: 1; padding: 12px;
		background: #26201a; color: white;
		border: none; border-radius: 10px;
		font-size: 0.95rem; font-weight: 700;
		font-family: inherit; cursor: pointer;
	}
	.submit-btn:disabled, .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.preview-btn {
		padding: 12px 16px;
		background: white; color: #5a6e99;
		border: 1.5px solid #c8d4f0; border-radius: 10px;
		font-size: 0.88rem; font-family: inherit;
		cursor: pointer; white-space: nowrap; font-weight: 600;
		flex-shrink: 0;
	}
	.preview-btn:hover { background: #f0f4ff; }
	.preview-btn.small { padding: 12px 12px; font-size: 0.8rem; }

	/* 商品一覧 */
	.product-list {
		padding: 12px 16px;
		display: flex; flex-direction: column; gap: 10px;
	}

	.loading, .empty {
		text-align: center; padding: 60px 20px;
		color: #9e9289; font-size: 0.9rem; line-height: 1.8;
	}

	.product-item {
		background: white; border-radius: 14px;
		box-shadow: 0 2px 8px rgba(0,0,0,0.06);
		overflow: hidden; transition: opacity 0.2s;
	}
	.product-item.inactive { opacity: 0.65; }

	.product-row {
		display: flex; align-items: center; gap: 12px;
		padding: 12px 14px;
	}
	.product-thumb-wrap {
		position: relative; flex-shrink: 0;
	}
	.product-thumb {
		width: 64px; height: 64px; border-radius: 10px;
		object-fit: cover; display: block;
	}
	.no-img {
		width: 64px; height: 64px; border-radius: 10px;
		background: #f0ede8; display: flex;
		align-items: center; justify-content: center;
		font-size: 1.6rem;
	}
	.soldout-badge {
		position: absolute; bottom: 2px; left: 0; right: 0;
		background: rgba(0,0,0,0.65); color: white;
		font-size: 0.5rem; font-weight: 800; letter-spacing: 0.08em;
		text-align: center; padding: 2px 0; border-radius: 0 0 8px 8px;
	}
	.photo-count {
		position: absolute; top: -4px; right: -4px;
		background: #d56d04; color: white;
		font-size: 0.6rem; font-weight: 700;
		border-radius: 10px; padding: 1px 5px;
	}

	.product-info { flex: 1; min-width: 0; }
	.product-name {
		font-size: 0.9rem; font-weight: 700; color: #26201a;
		margin: 0 0 2px;
		overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
	}
	.product-price { font-size: 0.85rem; color: #26201a; margin: 0 0 2px; }
	.product-meta { font-size: 0.72rem; color: #9e9289; margin: 0; }
	.inactive-badge {
		display: inline-block; font-size: 0.65rem;
		background: #fef3cd; color: #856404;
		border: 1px solid #fde68a;
		border-radius: 4px; padding: 1px 6px; margin-top: 4px;
	}

	.product-actions {
		display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;
	}
	.action-btn {
		padding: 5px 10px; border-radius: 7px;
		font-size: 0.72rem; font-family: inherit;
		cursor: pointer; font-weight: 600; border: 1.5px solid;
		white-space: nowrap;
	}
	.action-btn.edit { background: white; color: #26201a; border-color: #e8e0d8; }
	.action-btn.toggle { background: white; color: #5a6e99; border-color: #c8d4f0; }
	.action-btn.delete { background: white; color: #c62828; border-color: #fecaca; }

	.edit-form { padding: 16px; }
	.edit-actions {
		display: flex; gap: 8px; margin-top: 8px; align-items: stretch;
	}
	.save-btn { margin-top: 0; }
	.cancel-btn {
		padding: 12px 16px;
		background: #f5f0ea; color: #7a6f67;
		border: none; border-radius: 10px;
		font-size: 0.9rem; font-family: inherit; cursor: pointer;
		flex-shrink: 0;
	}

	/* プレビューモーダル */
	.modal-backdrop {
		position: fixed; inset: 0; z-index: 100;
		background: rgba(0,0,0,0.55);
		display: flex; align-items: flex-end; justify-content: center;
	}
	.modal-box {
		background: white; border-radius: 20px 20px 0 0;
		width: 100%; max-width: 560px;
		max-height: 85svh; overflow-y: auto;
	}
	.modal-header {
		display: flex; align-items: center; justify-content: space-between;
		padding: 14px 16px 10px;
		border-bottom: 1px solid #f0ede8;
		position: sticky; top: 0; background: white; z-index: 1;
	}
	.modal-label {
		font-size: 0.8rem; color: #9e9289; font-weight: 600;
	}
	.modal-close {
		background: #f0ede8; border: none; border-radius: 50%;
		width: 28px; height: 28px; cursor: pointer;
		font-size: 0.8rem; color: #5a5250;
		display: flex; align-items: center; justify-content: center;
	}

	.preview-body { padding-bottom: 24px; }
	.preview-main-img {
		width: 100%; aspect-ratio: 4/3;
		object-fit: cover; display: block;
	}
	.preview-no-img {
		width: 100%; aspect-ratio: 4/3;
		background: #f0ede8;
		display: flex; align-items: center; justify-content: center;
		font-size: 1.2rem; color: #9e9289;
	}
	.preview-thumbs {
		display: flex; gap: 4px; padding: 6px 12px;
		overflow-x: auto;
	}
	.preview-thumb-sm {
		width: 52px; height: 52px; border-radius: 8px;
		object-fit: cover; flex-shrink: 0;
		border: 1.5px solid #e8e0d8;
	}
	.preview-info { padding: 16px; }
	.preview-category {
		display: inline-block;
		font-size: 0.72rem; color: #9e9289;
		background: #f5f0ea; border-radius: 4px;
		padding: 2px 8px; margin-bottom: 8px;
	}
	.preview-name {
		font-size: 1.1rem; font-weight: 700; color: #26201a;
		margin: 0 0 6px;
	}
	.preview-price {
		font-size: 1.2rem; font-weight: 700; color: #26201a;
		margin: 0 0 8px;
	}
	.preview-soldout {
		display: inline-block;
		background: #26201a; color: white;
		font-size: 0.72rem; font-weight: 800; letter-spacing: 0.1em;
		border-radius: 4px; padding: 3px 10px; margin-bottom: 8px;
	}
	.preview-stock-warn {
		display: inline-block;
		color: #c62828; font-size: 0.8rem; font-weight: 600;
		margin-bottom: 8px;
	}
	.preview-desc {
		font-size: 0.88rem; color: #5a5250; line-height: 1.7;
		white-space: pre-wrap; margin: 12px 0;
	}
	.preview-tags {
		display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px;
	}
	.preview-tag {
		font-size: 0.78rem; color: #7a6f67;
		background: #f5f0ea; border-radius: 20px;
		padding: 3px 10px;
	}
</style>
