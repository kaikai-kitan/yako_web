<svelte:head>
	<title>在庫管理 | YATAKARI</title>
</svelte:head>

<script>
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase.js';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';

	let userId = $state(null);
	let items = $state([]);
	let isLoading = $state(true);
	let saveError = $state('');
	let saveMsg = $state('');

	// 新規追加フォーム
	let newName = $state('');
	let newUnitPrice = $state('');
	let newRequired = $state('');
	let newCurrent = $state('');
	let isAdding = $state(false);

	// インライン編集
	let editingId = $state(null);
	let editName = $state('');
	let editUnitPrice = $state('');
	let editRequired = $state('');
	let editCurrent = $state('');
	let isSaving = $state(false);

	// 集計
	let totalItems = $derived(items.length);
	let shortageItems = $derived(items.filter((i) => shortage(i) > 0).length);
	let totalNeeded = $derived(
		items.reduce((s, i) => s + Math.max(0, shortage(i)) * i.unit_price, 0)
	);

	function shortage(item) {
		return item.required_qty - item.current_qty;
	}

	onMount(async () => {
		const {
			data: { user }
		} = await supabase.auth.getUser();
		if (!user) {
			goto(`${base}/`);
			return;
		}
		userId = user.id;
		await loadItems();
	});

	async function loadItems() {
		isLoading = true;
		const { data, error } = await supabase
			.from('inventory')
			.select('*')
			.eq('user_id', userId)
			.order('created_at', { ascending: true });
		if (!error) items = data ?? [];
		isLoading = false;
	}

	async function addItem() {
		if (!newName.trim() || newUnitPrice === '' || newRequired === '' || newCurrent === '') return;
		isAdding = true;
		saveError = '';

		const { error } = await supabase.from('inventory').insert({
			user_id: userId,
			name: newName.trim(),
			unit_price: parseInt(newUnitPrice) || 0,
			required_qty: parseInt(newRequired) || 0,
			current_qty: parseInt(newCurrent) || 0
		});

		if (error) {
			saveError = '追加失敗: ' + error.message;
		} else {
			newName = '';
			newUnitPrice = '';
			newRequired = '';
			newCurrent = '';
			showMsg('追加しました');
			await loadItems();
		}
		isAdding = false;
	}

	function startEdit(item) {
		editingId = item.id;
		editName = item.name;
		editUnitPrice = String(item.unit_price);
		editRequired = String(item.required_qty);
		editCurrent = String(item.current_qty);
	}

	function cancelEdit() {
		editingId = null;
	}

	async function saveEdit(id) {
		isSaving = true;
		saveError = '';
		const { error } = await supabase
			.from('inventory')
			.update({
				name: editName.trim(),
				unit_price: parseInt(editUnitPrice) || 0,
				required_qty: parseInt(editRequired) || 0,
				current_qty: parseInt(editCurrent) || 0
			})
			.eq('id', id)
			.eq('user_id', userId);

		if (error) {
			saveError = '更新失敗: ' + error.message;
		} else {
			editingId = null;
			showMsg('更新しました');
			await loadItems();
		}
		isSaving = false;
	}

	async function deleteItem(id) {
		if (!confirm('この商品を削除しますか？')) return;
		const { error } = await supabase
			.from('inventory')
			.delete()
			.eq('id', id)
			.eq('user_id', userId);
		if (error) {
			saveError = '削除失敗: ' + error.message;
		} else {
			showMsg('削除しました');
			await loadItems();
		}
	}

	function showMsg(msg) {
		saveMsg = msg;
		setTimeout(() => (saveMsg = ''), 2500);
	}

	function fmt(n) {
		return `¥${(n ?? 0).toLocaleString()}`;
	}
</script>

<div class="page">
	<div class="page-header">
		<a href="{base}/mypage/dashboard" class="back-link">‹ 収益ダッシュボード</a>
		<h1 class="page-title">📦 在庫管理</h1>
	</div>

	<!-- サマリーカード -->
	<div class="summary-grid">
		<div class="summary-card">
			<span class="s-label">登録商品数</span>
			<span class="s-value">{totalItems}件</span>
		</div>
		<div class="summary-card" class:warning={shortageItems > 0}>
			<span class="s-label">不足商品数</span>
			<span class="s-value">{shortageItems}件</span>
		</div>
		<div class="summary-card" class:warning={totalNeeded > 0}>
			<span class="s-label">必要資金合計</span>
			<span class="s-value">{fmt(totalNeeded)}</span>
		</div>
	</div>

	{#if saveMsg}<p class="success-msg">{saveMsg}</p>{/if}
	{#if saveError}<p class="error-msg">{saveError}</p>{/if}

	<!-- 新規追加フォーム -->
	<div class="add-form-card">
		<h2 class="form-title">＋ 商品を追加</h2>
		<div class="add-form">
			<input
				type="text"
				bind:value={newName}
				placeholder="商品名"
				class="input input-name"
			/>
			<input
				type="number"
				bind:value={newUnitPrice}
				placeholder="単価 (¥)"
				class="input input-num"
				min="0"
			/>
			<input
				type="number"
				bind:value={newRequired}
				placeholder="必要数"
				class="input input-num"
				min="0"
			/>
			<input
				type="number"
				bind:value={newCurrent}
				placeholder="現在数"
				class="input input-num"
				min="0"
			/>
			<button
				class="btn-add"
				onclick={addItem}
				disabled={isAdding || !newName.trim()}
			>
				{isAdding ? '追加中...' : '追加'}
			</button>
		</div>
	</div>

	<!-- 在庫テーブル -->
	{#if isLoading}
		<div class="loading">読み込み中...</div>
	{:else if items.length === 0}
		<div class="empty">在庫データがありません。商品を追加してください。</div>
	{:else}
		<div class="table-wrap">
			<table class="inv-table">
				<thead>
					<tr>
						<th class="col-name">商品名</th>
						<th class="col-num">単価</th>
						<th class="col-num">必要数</th>
						<th class="col-num">現在数</th>
						<th class="col-num">不足数</th>
						<th class="col-num">必要資金</th>
						<th class="col-actions"></th>
					</tr>
				</thead>
				<tbody>
					{#each items as item (item.id)}
						{@const short = shortage(item)}
						{@const needsFunds = Math.max(0, short) * item.unit_price}
						{#if editingId === item.id}
							<!-- 編集行 -->
							<tr class="edit-row">
								<td>
									<input type="text" bind:value={editName} class="input-inline" />
								</td>
								<td>
									<input type="number" bind:value={editUnitPrice} class="input-inline input-inline-num" min="0" />
								</td>
								<td>
									<input type="number" bind:value={editRequired} class="input-inline input-inline-num" min="0" />
								</td>
								<td>
									<input type="number" bind:value={editCurrent} class="input-inline input-inline-num" min="0" />
								</td>
								<td colspan="2"></td>
								<td class="action-cell">
									<button class="btn-save" onclick={() => saveEdit(item.id)} disabled={isSaving}>
										{isSaving ? '…' : '保存'}
									</button>
									<button class="btn-cancel" onclick={cancelEdit}>取消</button>
								</td>
							</tr>
						{:else}
							<!-- 通常行 -->
							<tr class:shortage-row={short > 0}>
								<td class="col-name">
									{#if short > 0}
										<span class="shortage-dot" title="在庫不足">!</span>
									{/if}
									{item.name}
								</td>
								<td class="col-num">{fmt(item.unit_price)}</td>
								<td class="col-num">{item.required_qty}</td>
								<td class="col-num">{item.current_qty}</td>
								<td class="col-num" class:shortage-num={short > 0}>
									{short > 0 ? `−${short}` : '—'}
								</td>
								<td class="col-num" class:shortage-num={needsFunds > 0}>
									{needsFunds > 0 ? fmt(needsFunds) : '—'}
								</td>
								<td class="action-cell">
									<button class="btn-edit" onclick={() => startEdit(item)}>編集</button>
									<button class="btn-delete" onclick={() => deleteItem(item.id)}>削除</button>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>

		<!-- 凡例 -->
		{#if shortageItems > 0}
			<div class="legend">
				<span class="shortage-dot">!</span> のある行は在庫不足です。早めに補充してください。
			</div>
		{/if}
	{/if}
</div>

<style>
	.page {
		max-width: 900px;
		margin: 0 auto;
		padding: 24px 16px 80px;
		color: #26201a;
	}
	.page-header {
		margin-bottom: 20px;
	}
	.back-link {
		font-size: 0.85rem;
		color: #7a6f67;
		text-decoration: none;
	}
	.back-link:hover {
		color: #d56d04;
	}
	.page-title {
		font-size: 1.3rem;
		font-weight: 700;
		margin: 6px 0 0;
	}

	/* サマリー */
	.summary-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 12px;
		margin-bottom: 20px;
	}
	.summary-card {
		background: #faf8f5;
		border: 1px solid #e8e0d8;
		border-radius: 12px;
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.summary-card.warning {
		background: #fff7ed;
		border-color: #fed7aa;
	}
	.s-label {
		font-size: 0.75rem;
		color: #7a6f67;
	}
	.s-value {
		font-size: 1.3rem;
		font-weight: 700;
	}
	.summary-card.warning .s-value {
		color: #c0392b;
	}

	.success-msg {
		font-size: 0.85rem;
		color: #2d8a4e;
		margin: 0 0 12px;
	}
	.error-msg {
		font-size: 0.85rem;
		color: #c0392b;
		margin: 0 0 12px;
	}

	/* 追加フォーム */
	.add-form-card {
		background: #fff;
		border: 1px solid #e8e0d8;
		border-radius: 14px;
		padding: 16px 20px;
		margin-bottom: 24px;
	}
	.form-title {
		font-size: 0.9rem;
		font-weight: 700;
		margin: 0 0 12px;
		color: #26201a;
	}
	.add-form {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		align-items: center;
	}
	.input {
		padding: 8px 10px;
		border: 1px solid #ddd;
		border-radius: 8px;
		font-size: 0.88rem;
	}
	.input:focus {
		outline: 2px solid #d56d04;
		border-color: transparent;
	}
	.input-name {
		flex: 2;
		min-width: 140px;
	}
	.input-num {
		flex: 1;
		min-width: 80px;
	}
	.btn-add {
		padding: 8px 20px;
		background: #26201a;
		color: #fff;
		border: none;
		border-radius: 8px;
		font-size: 0.88rem;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
	}
	.btn-add:disabled {
		background: #bbb;
		cursor: default;
	}

	/* テーブル */
	.loading {
		text-align: center;
		padding: 40px;
		color: #7a6f67;
	}
	.empty {
		text-align: center;
		padding: 40px;
		color: #9e9289;
		font-size: 0.9rem;
	}
	.table-wrap {
		overflow-x: auto;
		border: 1px solid #e8e0d8;
		border-radius: 14px;
	}
	.inv-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.88rem;
	}
	.inv-table th {
		padding: 10px 14px;
		text-align: left;
		font-size: 0.78rem;
		color: #7a6f67;
		background: #faf8f5;
		border-bottom: 1px solid #e8e0d8;
		white-space: nowrap;
	}
	.inv-table td {
		padding: 11px 14px;
		border-bottom: 1px solid #f0ede8;
		vertical-align: middle;
	}
	.inv-table tr:last-child td {
		border-bottom: none;
	}
	.col-num {
		text-align: right;
	}
	.col-actions {
		width: 1%;
	}

	/* 不足行ハイライト */
	.shortage-row {
		background: #fff7ed;
	}
	.shortage-row:hover {
		background: #fff0de;
	}
	.shortage-num {
		color: #c0392b;
		font-weight: 700;
	}
	.shortage-dot {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		background: #c0392b;
		color: #fff;
		font-size: 0.65rem;
		font-weight: 800;
		border-radius: 50%;
		margin-right: 4px;
		vertical-align: middle;
	}

	/* アクションボタン */
	.action-cell {
		display: flex;
		gap: 6px;
		justify-content: flex-end;
		white-space: nowrap;
	}
	.btn-edit {
		padding: 5px 12px;
		font-size: 0.78rem;
		background: #faf8f5;
		border: 1px solid #e8e0d8;
		border-radius: 6px;
		cursor: pointer;
		color: #26201a;
	}
	.btn-edit:hover {
		border-color: #d56d04;
		color: #d56d04;
	}
	.btn-delete {
		padding: 5px 10px;
		font-size: 0.78rem;
		background: #fff;
		border: 1px solid #fca5a5;
		border-radius: 6px;
		cursor: pointer;
		color: #c0392b;
	}
	.btn-delete:hover {
		background: #fef2f2;
	}

	/* 編集行 */
	.edit-row {
		background: #fffbf5;
	}
	.input-inline {
		padding: 6px 8px;
		border: 1.5px solid #d56d04;
		border-radius: 6px;
		font-size: 0.85rem;
		width: 100%;
		box-sizing: border-box;
	}
	.input-inline-num {
		text-align: right;
		max-width: 80px;
	}
	.btn-save {
		padding: 5px 12px;
		background: #26201a;
		color: #fff;
		border: none;
		border-radius: 6px;
		font-size: 0.78rem;
		cursor: pointer;
	}
	.btn-cancel {
		padding: 5px 10px;
		background: #f0ede8;
		border: none;
		border-radius: 6px;
		font-size: 0.78rem;
		cursor: pointer;
		color: #7a6f67;
	}

	.legend {
		margin-top: 12px;
		font-size: 0.78rem;
		color: #7a6f67;
		display: flex;
		align-items: center;
		gap: 6px;
	}
</style>
