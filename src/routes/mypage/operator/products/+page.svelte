<svelte:head>
	<title>商品管理 | 出店者ダッシュボード</title>
</svelte:head>

<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';

	let userId = $state(null);
	let products = $state([]);
	let isLoading = $state(true);
	let msg = $state('');
	let errMsg = $state('');

	// 追加フォーム
	let showAddForm = $state(false);
	let isSubmitting = $state(false);
	let photoFile = $state(null);
	let photoPreview = $state('');
	let newProduct = $state({
		name: '',
		description: '',
		price: '',
		stock: '',
		category: '',
		tags: ''
	});

	// 編集
	let editingId = $state(null);
	let editProduct = $state({});
	let editPhotoFile = $state(null);
	let editPhotoPreview = $state('');
	let isSaving = $state(false);

	const CATEGORIES = ['', 'フード', 'ドリンク', '雑貨', 'アクセサリー', 'アート', 'その他'];

	onMount(async () => {
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

	function handlePhotoChange(e, mode) {
		const file = e.target.files?.[0];
		if (!file) return;
		if (mode === 'new') {
			photoFile = file;
			photoPreview = URL.createObjectURL(file);
		} else {
			editPhotoFile = file;
			editPhotoPreview = URL.createObjectURL(file);
		}
	}

	async function uploadPhoto(file) {
		const ext = file.name.split('.').pop().toLowerCase();
		const path = `${userId}/${Date.now()}.${ext}`;
		const { error } = await supabase.storage.from('shop-images').upload(path, file, { upsert: false });
		if (error) throw new Error('画像のアップロードに失敗しました: ' + error.message);
		const { data } = supabase.storage.from('shop-images').getPublicUrl(path);
		return data.publicUrl;
	}

	async function addProduct() {
		if (!newProduct.name.trim() || !newProduct.price) {
			errMsg = '商品名と価格は必須です';
			return;
		}
		isSubmitting = true;
		errMsg = '';
		try {
			let photoUrl = null;
			if (photoFile) { photoUrl = await uploadPhoto(photoFile); }

			const tagsArr = newProduct.tags
				? newProduct.tags.split(/[,、]/).map(t => t.trim()).filter(Boolean)
				: [];

			const { error } = await supabase.from('shop_products').insert({
				operator_id: userId,
				name: newProduct.name.trim(),
				description: newProduct.description.trim() || null,
				price: parseInt(newProduct.price, 10),
				stock: newProduct.stock !== '' ? parseInt(newProduct.stock, 10) : null,
				category: newProduct.category || null,
				tags: tagsArr.length ? tagsArr : null,
				photo_url: photoUrl,
				is_active: true,
				display_order: products.length
			});

			if (error) throw new Error(error.message);

			msg = '商品を追加しました';
			showAddForm = false;
			newProduct = { name: '', description: '', price: '', stock: '', category: '', tags: '' };
			photoFile = null;
			photoPreview = '';
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
			category: product.category ?? '',
			tags: (product.tags ?? []).join(', '),
			photo_url: product.photo_url ?? ''
		};
		editPhotoFile = null;
		editPhotoPreview = '';
	}

	function cancelEdit() {
		editingId = null;
		editPhotoFile = null;
		editPhotoPreview = '';
	}

	async function saveEdit(productId) {
		if (!editProduct.name.trim() || !editProduct.price) {
			errMsg = '商品名と価格は必須です';
			return;
		}
		isSaving = true;
		errMsg = '';
		try {
			let photoUrl = editProduct.photo_url || null;
			if (editPhotoFile) { photoUrl = await uploadPhoto(editPhotoFile); }

			const tagsArr = editProduct.tags
				? editProduct.tags.split(/[,、]/).map(t => t.trim()).filter(Boolean)
				: [];

			const { error } = await supabase.from('shop_products').update({
				name: editProduct.name.trim(),
				description: editProduct.description.trim() || null,
				price: parseInt(editProduct.price, 10),
				stock: editProduct.stock !== '' ? parseInt(editProduct.stock, 10) : null,
				category: editProduct.category || null,
				tags: tagsArr.length ? tagsArr : null,
				photo_url: photoUrl
			}).eq('id', productId);

			if (error) throw new Error(error.message);

			msg = '保存しました';
			editingId = null;
			editPhotoFile = null;
			editPhotoPreview = '';
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
</script>

<div class="page">
	<header class="top-bar">
		<a href="{base}/mypage/operator" class="back-link">← ダッシュボードに戻る</a>
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

			<label class="field">
				<span class="label">商品写真</span>
				<div class="photo-upload">
					{#if photoPreview}
						<img src={photoPreview} alt="プレビュー" class="photo-preview" />
					{:else}
						<div class="photo-placeholder">📷 写真を選択</div>
					{/if}
					<input type="file" accept="image/*" class="file-input" onchange={(e) => handlePhotoChange(e, 'new')} />
				</div>
			</label>

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

			<label class="field">
				<span class="label">タグ <small>（カンマ区切り）</small></span>
				<input class="input" type="text" bind:value={newProduct.tags} placeholder="例: ハンドメイド, 京都" />
			</label>

			<button class="submit-btn" onclick={addProduct} disabled={isSubmitting}>
				{isSubmitting ? '追加中…' : '商品を追加する'}
			</button>
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
							<label class="field">
								<span class="label">商品写真</span>
								<div class="photo-upload">
									{#if editPhotoPreview}
										<img src={editPhotoPreview} alt="プレビュー" class="photo-preview" />
									{:else if editProduct.photo_url}
										<img src={editProduct.photo_url} alt="現在の写真" class="photo-preview" />
									{:else}
										<div class="photo-placeholder">📷 写真を選択</div>
									{/if}
									<input type="file" accept="image/*" class="file-input" onchange={(e) => handlePhotoChange(e, 'edit')} />
								</div>
							</label>

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

							<label class="field">
								<span class="label">タグ <small>（カンマ区切り）</small></span>
								<input class="input" type="text" bind:value={editProduct.tags} />
							</label>

							<div class="edit-actions">
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
								{#if product.photo_url}
									<img src={product.photo_url} alt={product.name} class="product-thumb" />
								{:else}
									<div class="product-thumb no-img">🛍</div>
								{/if}
								{#if product.stock !== null && product.stock <= 0}
									<span class="soldout-badge">SOLD OUT</span>
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
									{product.is_active ? '非公開にする' : '公開する'}
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

	/* フォームカード */
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
	.label.required::after {
		content: ' *'; color: #c62828;
	}
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

	/* 写真アップロード */
	.photo-upload {
		position: relative;
		width: 120px; height: 120px;
		border: 2px dashed #e8e0d8;
		border-radius: 12px;
		overflow: hidden; cursor: pointer;
	}
	.photo-upload:hover { border-color: #d56d04; }
	.photo-preview {
		width: 100%; height: 100%; object-fit: cover; display: block;
	}
	.photo-placeholder {
		width: 100%; height: 100%;
		display: flex; align-items: center; justify-content: center;
		font-size: 0.8rem; color: #9e9289; text-align: center;
		padding: 8px;
	}
	.file-input {
		position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%;
	}

	.submit-btn, .save-btn {
		width: 100%; padding: 12px;
		background: #26201a; color: white;
		border: none; border-radius: 10px;
		font-size: 0.95rem; font-weight: 700;
		font-family: inherit; cursor: pointer;
		margin-top: 4px;
	}
	.submit-btn:disabled, .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

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
		overflow: hidden;
		transition: opacity 0.2s;
	}
	.product-item.inactive { opacity: 0.65; }

	/* 表示モード */
	.product-row {
		display: flex; align-items: center; gap: 12px;
		padding: 12px 14px;
	}
	.product-thumb-wrap {
		position: relative; flex-shrink: 0;
	}
	.product-thumb {
		width: 64px; height: 64px; border-radius: 10px;
		object-fit: cover; display: block; flex-shrink: 0;
	}
	.no-img {
		width: 64px; height: 64px; border-radius: 10px;
		background: #f0ede8; display: flex;
		align-items: center; justify-content: center;
		font-size: 1.6rem; flex-shrink: 0;
	}
	.soldout-badge {
		position: absolute; bottom: 2px; left: 0; right: 0;
		background: rgba(0,0,0,0.65); color: white;
		font-size: 0.5rem; font-weight: 800; letter-spacing: 0.08em;
		text-align: center; padding: 2px 0; border-radius: 0 0 8px 8px;
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

	/* 編集フォーム */
	.edit-form { padding: 16px; }
	.edit-actions { display: flex; gap: 8px; margin-top: 8px; }
	.save-btn { flex: 1; margin-top: 0; }
	.cancel-btn {
		flex-shrink: 0; padding: 12px 16px;
		background: #f5f0ea; color: #7a6f67;
		border: none; border-radius: 10px;
		font-size: 0.9rem; font-family: inherit; cursor: pointer;
	}
</style>
