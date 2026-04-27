<svelte:head>
	<title>在庫管理 | YATAKARI</title>
</svelte:head>

<script>
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase.js';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';

	let userId = $state(null);
	let tab = $state('menu'); // 'menu' | 'stock'

	// ---- データ ----
	let menuItems = $state([]);   // my_menu_items
	let invItems = $state([]);    // inventory
	let ingredients = $state([]); // menu_ingredients + inventory join
	let isLoading = $state(true);

	// ---- メッセージ ----
	let msg = $state('');
	let errMsg = $state('');

	// ---- メニュー別タブ ----
	let expandedMenuId = $state(null);
	// 追加フォーム状態: { menuItemId, type } | null
	let addIngForm = $state(null);
	let addInvId = $state('');
	let addQty = $state('1');
	let addUnit = $state('個');
	let isAddingIng = $state(false);

	// ---- 在庫管理タブ ----
	let newName = $state('');
	let newUnitPrice = $state('');
	let newRequired = $state('');
	let newCurrent = $state('');
	let isAdding = $state(false);
	let editingId = $state(null);
	let editName = $state('');
	let editUnitPrice = $state('');
	let editRequired = $state('');
	let editCurrent = $state('');
	let isSaving = $state(false);

	// ---- 集計 ----
	let totalItems = $derived(invItems.length);
	let shortageItems = $derived(invItems.filter((i) => i.required_qty > i.current_qty).length);
	let totalNeeded = $derived(
		invItems.reduce((s, i) => s + Math.max(0, i.required_qty - i.current_qty) * i.unit_price, 0)
	);

	// menu_ingredients を menu_item_id でグループ化
	let ingByMenu = $derived(() => {
		const map = {};
		for (const ing of ingredients) {
			if (!map[ing.menu_item_id]) map[ing.menu_item_id] = { ingredient: [], consumable: [] };
			map[ing.menu_item_id][ing.item_type].push(ing);
		}
		return map;
	});

	const UNITS = ['個', '枚', '本', '袋', 'g', 'ml', 'L', '杯', '切れ', '束'];

	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) { goto(`${base}/`); return; }
		userId = user.id;
		await loadAll();
	});

	async function loadAll() {
		isLoading = true;
		await Promise.all([loadMenu(), loadInv(), loadIngredients()]);
		isLoading = false;
	}

	async function loadMenu() {
		const { data } = await supabase
			.from('my_menu_items')
			.select('id, name, description, price, photo_path')
			.eq('user_id', userId)
			.order('display_order', { ascending: true });
		menuItems = data ?? [];
	}

	async function loadInv() {
		const { data } = await supabase
			.from('inventory')
			.select('*')
			.eq('user_id', userId)
			.order('created_at', { ascending: true });
		invItems = data ?? [];
	}

	async function loadIngredients() {
		const { data } = await supabase
			.from('menu_ingredients')
			.select('*, inventory(id, name, current_qty, required_qty, unit_price)')
			.eq('user_id', userId);
		ingredients = data ?? [];
	}

	// ======== メニュー別: 食材・消耗品 ========

	function openAddIng(menuItemId, type) {
		addIngForm = { menuItemId, type };
		addInvId = '';
		addQty = '1';
		addUnit = '個';
	}

	function closeAddIng() {
		addIngForm = null;
	}

	async function addIngredient() {
		if (!addIngForm || !addInvId || !addQty) return;
		isAddingIng = true;
		errMsg = '';

		const { error } = await supabase.from('menu_ingredients').insert({
			user_id: userId,
			menu_item_id: addIngForm.menuItemId,
			inventory_item_id: addInvId || null,
			item_type: addIngForm.type,
			qty_per_serving: parseFloat(addQty) || 1,
			unit: addUnit
		});

		if (error) {
			errMsg = '追加失敗: ' + error.message;
		} else {
			addIngForm = null;
			flash('追加しました');
			await loadIngredients();
		}
		isAddingIng = false;
	}

	async function deleteIngredient(id) {
		if (!confirm('この項目を削除しますか？')) return;
		const { error } = await supabase
			.from('menu_ingredients')
			.delete()
			.eq('id', id)
			.eq('user_id', userId);
		if (!error) {
			flash('削除しました');
			await loadIngredients();
		}
	}

	// ======== 在庫 CRUD ========

	async function addItem() {
		if (!newName.trim()) return;
		isAdding = true;
		errMsg = '';
		const { error } = await supabase.from('inventory').insert({
			user_id: userId,
			name: newName.trim(),
			unit_price: parseInt(newUnitPrice) || 0,
			required_qty: parseInt(newRequired) || 0,
			current_qty: parseInt(newCurrent) || 0
		});
		if (error) { errMsg = '追加失敗: ' + error.message; }
		else { newName = ''; newUnitPrice = ''; newRequired = ''; newCurrent = ''; flash('追加しました'); await loadInv(); }
		isAdding = false;
	}

	function startEdit(item) {
		editingId = item.id;
		editName = item.name;
		editUnitPrice = String(item.unit_price);
		editRequired = String(item.required_qty);
		editCurrent = String(item.current_qty);
	}

	function cancelEdit() { editingId = null; }

	async function saveEdit(id) {
		isSaving = true;
		errMsg = '';
		const { error } = await supabase
			.from('inventory')
			.update({ name: editName.trim(), unit_price: parseInt(editUnitPrice) || 0, required_qty: parseInt(editRequired) || 0, current_qty: parseInt(editCurrent) || 0 })
			.eq('id', id).eq('user_id', userId);
		if (error) { errMsg = '更新失敗: ' + error.message; }
		else { editingId = null; flash('更新しました'); await Promise.all([loadInv(), loadIngredients()]); }
		isSaving = false;
	}

	async function deleteItem(id) {
		if (!confirm('この商品を削除しますか？\n（このアイテムを参照するメニュー紐付けも解除されます）')) return;
		const { error } = await supabase.from('inventory').delete().eq('id', id).eq('user_id', userId);
		if (!error) { flash('削除しました'); await Promise.all([loadInv(), loadIngredients()]); }
	}

	function flash(m) {
		msg = m;
		setTimeout(() => (msg = ''), 2500);
	}

	function fmt(n) { return `¥${(n ?? 0).toLocaleString()}`; }

	function stockStatus(ing) {
		const inv = ing.inventory;
		if (!inv) return null;
		const shortage = inv.required_qty - inv.current_qty;
		return shortage > 0 ? 'shortage' : 'ok';
	}
</script>

<div class="page">
	<div class="page-header">
		<a href="{base}/mypage/dashboard" class="back-link">‹ 収益ダッシュボード</a>
		<h1 class="page-title">📦 在庫管理</h1>
	</div>

	<!-- タブ -->
	<div class="tabs">
		<button class="tab-btn" class:active={tab === 'menu'} onclick={() => (tab = 'menu')}>
			🍽️ メニュー別食材・消耗品
		</button>
		<button class="tab-btn" class:active={tab === 'stock'} onclick={() => (tab = 'stock')}>
			📋 在庫一覧
			{#if shortageItems > 0}
				<span class="tab-badge">{shortageItems}</span>
			{/if}
		</button>
	</div>

	{#if msg}<p class="success-msg">{msg}</p>{/if}
	{#if errMsg}<p class="error-msg">{errMsg}</p>{/if}

	{#if isLoading}
		<div class="loading">読み込み中...</div>

	<!-- ======== メニュー別タブ ======== -->
	{:else if tab === 'menu'}
		{#if menuItems.length === 0}
			<div class="empty">
				<p>登録されたメニューがありません。</p>
				<a href="{base}/mypage" class="empty-link">マイページでメニューを追加する ›</a>
			</div>
		{:else}
			{#if invItems.length === 0}
				<div class="notice">
					⚠️ 在庫アイテムが未登録です。先に「在庫一覧」タブで食材・消耗品を登録してください。
				</div>
			{/if}

			<div class="menu-list">
				{#each menuItems as menu (menu.id)}
					{@const menuIngs = ingByMenu()[menu.id] ?? { ingredient: [], consumable: [] }}
					{@const isExpanded = expandedMenuId === menu.id}

					<div class="menu-card">
						<!-- メニューヘッダー -->
						<div
							class="menu-header"
							role="button"
							tabindex="0"
							onclick={() => (expandedMenuId = isExpanded ? null : menu.id)}
							onkeydown={(e) => e.key === 'Enter' && (expandedMenuId = isExpanded ? null : menu.id)}
						>
							{#if menu.photo_path}
								<img src={menu.photo_path} alt={menu.name} class="menu-thumb" />
							{:else}
								<div class="menu-thumb-placeholder">🍽️</div>
							{/if}
							<div class="menu-info">
								<span class="menu-name">{menu.name}</span>
								{#if menu.description}
									<span class="menu-desc">{menu.description}</span>
								{/if}
								<span class="menu-price">{fmt(menu.price)}</span>
							</div>
							<div class="menu-meta">
								<span class="ing-count">
									食材 {menuIngs.ingredient.length}件 / 消耗品 {menuIngs.consumable.length}件
								</span>
								<span class="expand-icon">{isExpanded ? '▲' : '▼'}</span>
							</div>
						</div>

						<!-- 展開パネル -->
						{#if isExpanded}
							<div class="menu-detail">

								<!-- 食材セクション -->
								<div class="ing-section">
									<div class="ing-section-header">
										<h3 class="ing-section-title">🥬 食材</h3>
										<button
											class="btn-add-ing"
											onclick={() => openAddIng(menu.id, 'ingredient')}
										>＋ 追加</button>
									</div>

									{#if menuIngs.ingredient.length === 0}
										<p class="ing-empty">食材が未登録です</p>
									{:else}
										<div class="ing-list">
											{#each menuIngs.ingredient as ing (ing.id)}
												{@const status = stockStatus(ing)}
												<div class="ing-row" class:shortage={status === 'shortage'}>
													<div class="ing-left">
														{#if status === 'shortage'}
															<span class="shortage-dot" title="在庫不足">!</span>
														{/if}
														<span class="ing-name">
															{ing.inventory?.name ?? '（削除済みアイテム）'}
														</span>
													</div>
													<div class="ing-right">
														<span class="ing-qty">
															1食あたり {ing.qty_per_serving}{ing.unit}
														</span>
														{#if ing.inventory}
															<span class="ing-stock" class:stock-low={status === 'shortage'}>
																在庫: {ing.inventory.current_qty}{ing.unit}
															</span>
														{/if}
														<button class="btn-del-ing" onclick={() => deleteIngredient(ing.id)}>×</button>
													</div>
												</div>
											{/each}
										</div>
									{/if}

									<!-- 食材追加フォーム -->
									{#if addIngForm?.menuItemId === menu.id && addIngForm?.type === 'ingredient'}
										<div class="add-ing-form">
											<select bind:value={addInvId} class="sel-inv">
												<option value="">在庫アイテムを選択</option>
												{#each invItems as inv}
													<option value={inv.id}>{inv.name}</option>
												{/each}
											</select>
											<input type="number" bind:value={addQty} min="0.1" step="0.1" class="inp-qty" placeholder="数量" />
											<select bind:value={addUnit} class="sel-unit">
												{#each UNITS as u}<option value={u}>{u}</option>{/each}
											</select>
											<button class="btn-confirm" onclick={addIngredient} disabled={isAddingIng || !addInvId}>
												{isAddingIng ? '…' : '追加'}
											</button>
											<button class="btn-cancel-ing" onclick={closeAddIng}>取消</button>
										</div>
									{/if}
								</div>

								<!-- 消耗品セクション -->
								<div class="ing-section">
									<div class="ing-section-header">
										<h3 class="ing-section-title">🗂️ 消耗品</h3>
										<button
											class="btn-add-ing"
											onclick={() => openAddIng(menu.id, 'consumable')}
										>＋ 追加</button>
									</div>

									{#if menuIngs.consumable.length === 0}
										<p class="ing-empty">消耗品が未登録です（トレイ・袋・割り箸など）</p>
									{:else}
										<div class="ing-list">
											{#each menuIngs.consumable as ing (ing.id)}
												{@const status = stockStatus(ing)}
												<div class="ing-row consumable" class:shortage={status === 'shortage'}>
													<div class="ing-left">
														{#if status === 'shortage'}
															<span class="shortage-dot" title="在庫不足">!</span>
														{/if}
														<span class="ing-name">
															{ing.inventory?.name ?? '（削除済みアイテム）'}
														</span>
													</div>
													<div class="ing-right">
														<span class="ing-qty">
															1食あたり {ing.qty_per_serving}{ing.unit}
														</span>
														{#if ing.inventory}
															<span class="ing-stock" class:stock-low={status === 'shortage'}>
																在庫: {ing.inventory.current_qty}{ing.unit}
															</span>
														{/if}
														<button class="btn-del-ing" onclick={() => deleteIngredient(ing.id)}>×</button>
													</div>
												</div>
											{/each}
										</div>
									{/if}

									<!-- 消耗品追加フォーム -->
									{#if addIngForm?.menuItemId === menu.id && addIngForm?.type === 'consumable'}
										<div class="add-ing-form">
											<select bind:value={addInvId} class="sel-inv">
												<option value="">在庫アイテムを選択</option>
												{#each invItems as inv}
													<option value={inv.id}>{inv.name}</option>
												{/each}
											</select>
											<input type="number" bind:value={addQty} min="0.1" step="0.1" class="inp-qty" placeholder="数量" />
											<select bind:value={addUnit} class="sel-unit">
												{#each UNITS as u}<option value={u}>{u}</option>{/each}
											</select>
											<button class="btn-confirm" onclick={addIngredient} disabled={isAddingIng || !addInvId}>
												{isAddingIng ? '…' : '追加'}
											</button>
											<button class="btn-cancel-ing" onclick={closeAddIng}>取消</button>
										</div>
									{/if}
								</div>

							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

	<!-- ======== 在庫一覧タブ ======== -->
	{:else}
		<!-- サマリー -->
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

		<!-- 追加フォーム -->
		<div class="add-form-card">
			<h2 class="form-title">＋ 在庫アイテムを追加</h2>
			<div class="add-form">
				<input type="text" bind:value={newName} placeholder="商品名（例：紙トレイ、鴨肉）" class="input input-name" />
				<input type="number" bind:value={newUnitPrice} placeholder="単価 (¥)" class="input input-num" min="0" />
				<input type="number" bind:value={newRequired} placeholder="必要数" class="input input-num" min="0" />
				<input type="number" bind:value={newCurrent} placeholder="現在数" class="input input-num" min="0" />
				<button class="btn-add" onclick={addItem} disabled={isAdding || !newName.trim()}>
					{isAdding ? '追加中...' : '追加'}
				</button>
			</div>
		</div>

		<!-- テーブル -->
		{#if invItems.length === 0}
			<div class="empty">在庫データがありません。食材や消耗品を追加してください。</div>
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
						{#each invItems as item (item.id)}
							{@const short = item.required_qty - item.current_qty}
							{@const needsFunds = Math.max(0, short) * item.unit_price}
							{#if editingId === item.id}
								<tr class="edit-row">
									<td><input type="text" bind:value={editName} class="input-inline" /></td>
									<td><input type="number" bind:value={editUnitPrice} class="input-inline input-inline-num" min="0" /></td>
									<td><input type="number" bind:value={editRequired} class="input-inline input-inline-num" min="0" /></td>
									<td><input type="number" bind:value={editCurrent} class="input-inline input-inline-num" min="0" /></td>
									<td colspan="2"></td>
									<td class="action-cell">
										<button class="btn-save" onclick={() => saveEdit(item.id)} disabled={isSaving}>{isSaving ? '…' : '保存'}</button>
										<button class="btn-cancel" onclick={cancelEdit}>取消</button>
									</td>
								</tr>
							{:else}
								<tr class:shortage-row={short > 0}>
									<td class="col-name">
										{#if short > 0}<span class="shortage-dot" title="在庫不足">!</span>{/if}
										{item.name}
									</td>
									<td class="col-num">{fmt(item.unit_price)}</td>
									<td class="col-num">{item.required_qty}</td>
									<td class="col-num">{item.current_qty}</td>
									<td class="col-num" class:shortage-num={short > 0}>{short > 0 ? `−${short}` : '—'}</td>
									<td class="col-num" class:shortage-num={needsFunds > 0}>{needsFunds > 0 ? fmt(needsFunds) : '—'}</td>
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
			{#if shortageItems > 0}
				<div class="legend">
					<span class="shortage-dot">!</span> のある行は在庫不足です。早めに補充してください。
				</div>
			{/if}
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
	.page-header { margin-bottom: 20px; }
	.back-link { font-size: 0.85rem; color: #7a6f67; text-decoration: none; }
	.back-link:hover { color: #d56d04; }
	.page-title { font-size: 1.3rem; font-weight: 700; margin: 6px 0 0; }

	/* タブ */
	.tabs {
		display: flex;
		gap: 4px;
		margin-bottom: 20px;
		background: #f0ede8;
		border-radius: 12px;
		padding: 4px;
	}
	.tab-btn {
		flex: 1;
		padding: 9px 12px;
		border: none;
		background: transparent;
		border-radius: 9px;
		font-size: 0.88rem;
		font-weight: 600;
		color: #7a6f67;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		transition: background 0.15s, color 0.15s;
	}
	.tab-btn.active {
		background: #fff;
		color: #26201a;
		box-shadow: 0 1px 4px rgba(0,0,0,0.08);
	}
	.tab-badge {
		background: #c0392b;
		color: #fff;
		font-size: 0.7rem;
		padding: 1px 6px;
		border-radius: 999px;
	}

	.success-msg { font-size: 0.85rem; color: #2d8a4e; margin: 0 0 12px; }
	.error-msg { font-size: 0.85rem; color: #c0392b; margin: 0 0 12px; }
	.loading { text-align: center; padding: 60px; color: #7a6f67; }
	.empty { text-align: center; padding: 40px 20px; color: #9e9289; font-size: 0.9rem; }
	.empty-link { display: inline-block; margin-top: 10px; color: #d56d04; text-decoration: none; font-weight: 600; }

	.notice {
		background: #fffbeb;
		border: 1px solid #fcd34d;
		border-radius: 10px;
		padding: 10px 14px;
		font-size: 0.85rem;
		color: #78350f;
		margin-bottom: 16px;
	}

	/* ======== メニュー別 ======== */
	.menu-list { display: flex; flex-direction: column; gap: 12px; }

	.menu-card {
		background: #fff;
		border: 1.5px solid #e8e0d8;
		border-radius: 14px;
		overflow: hidden;
	}
	.menu-header {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 16px;
		cursor: pointer;
	}
	.menu-header:hover { background: #faf8f5; }
	.menu-thumb {
		width: 56px; height: 56px;
		object-fit: cover;
		border-radius: 8px;
		flex-shrink: 0;
	}
	.menu-thumb-placeholder {
		width: 56px; height: 56px;
		background: #f0ede8;
		border-radius: 8px;
		display: flex; align-items: center; justify-content: center;
		font-size: 1.6rem;
		flex-shrink: 0;
	}
	.menu-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.menu-name { font-size: 1rem; font-weight: 700; }
	.menu-desc { font-size: 0.78rem; color: #7a6f67; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.menu-price { font-size: 0.82rem; color: #d56d04; font-weight: 600; }
	.menu-meta {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
		flex-shrink: 0;
	}
	.ing-count { font-size: 0.75rem; color: #9e9289; }
	.expand-icon { font-size: 0.75rem; color: #bbb; }

	/* 展開パネル */
	.menu-detail {
		border-top: 1px solid #f0ede8;
		display: flex;
		flex-direction: column;
		gap: 0;
	}
	.ing-section {
		padding: 14px 16px;
		border-bottom: 1px solid #f0ede8;
	}
	.ing-section:last-child { border-bottom: none; }
	.ing-section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 10px;
	}
	.ing-section-title {
		font-size: 0.85rem;
		font-weight: 700;
		margin: 0;
		color: #26201a;
	}
	.btn-add-ing {
		padding: 4px 12px;
		background: #faf8f5;
		border: 1px solid #e8e0d8;
		border-radius: 6px;
		font-size: 0.78rem;
		cursor: pointer;
		color: #26201a;
	}
	.btn-add-ing:hover { border-color: #d56d04; color: #d56d04; }

	.ing-empty { font-size: 0.8rem; color: #9e9289; margin: 0; }

	.ing-list { display: flex; flex-direction: column; gap: 6px; }
	.ing-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 7px 10px;
		background: #faf8f5;
		border-radius: 8px;
		gap: 8px;
		flex-wrap: wrap;
	}
	.ing-row.consumable { background: #f0fdf4; }
	.ing-row.shortage { background: #fff7ed; }

	.ing-left { display: flex; align-items: center; gap: 6px; }
	.ing-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
	.ing-name { font-size: 0.88rem; font-weight: 600; }
	.ing-qty { font-size: 0.78rem; color: #7a6f67; }
	.ing-stock { font-size: 0.78rem; color: #2d8a4e; }
	.ing-stock.stock-low { color: #c0392b; font-weight: 700; }

	.btn-del-ing {
		width: 22px; height: 22px;
		background: none;
		border: 1px solid #e8e0d8;
		border-radius: 50%;
		font-size: 0.75rem;
		cursor: pointer;
		color: #9e9289;
		display: flex; align-items: center; justify-content: center;
	}
	.btn-del-ing:hover { background: #fef2f2; border-color: #fca5a5; color: #c0392b; }

	/* 追加フォーム (インライン) */
	.add-ing-form {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		align-items: center;
		margin-top: 10px;
		padding: 10px;
		background: #fffbf5;
		border: 1px dashed #d56d04;
		border-radius: 8px;
	}
	.sel-inv {
		flex: 2;
		min-width: 160px;
		padding: 6px 8px;
		border: 1px solid #ddd;
		border-radius: 7px;
		font-size: 0.85rem;
	}
	.inp-qty {
		width: 70px;
		padding: 6px 8px;
		border: 1px solid #ddd;
		border-radius: 7px;
		font-size: 0.85rem;
		text-align: right;
	}
	.sel-unit {
		width: 72px;
		padding: 6px 6px;
		border: 1px solid #ddd;
		border-radius: 7px;
		font-size: 0.85rem;
	}
	.btn-confirm {
		padding: 6px 14px;
		background: #26201a;
		color: #fff;
		border: none;
		border-radius: 7px;
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
	}
	.btn-confirm:disabled { background: #bbb; cursor: default; }
	.btn-cancel-ing {
		padding: 6px 10px;
		background: #f0ede8;
		border: none;
		border-radius: 7px;
		font-size: 0.82rem;
		cursor: pointer;
		color: #7a6f67;
	}

	/* ======== 在庫一覧タブ ======== */
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
		display: flex; flex-direction: column; gap: 4px;
	}
	.summary-card.warning { background: #fff7ed; border-color: #fed7aa; }
	.s-label { font-size: 0.75rem; color: #7a6f67; }
	.s-value { font-size: 1.3rem; font-weight: 700; }
	.summary-card.warning .s-value { color: #c0392b; }

	.add-form-card {
		background: #fff;
		border: 1px solid #e8e0d8;
		border-radius: 14px;
		padding: 16px 20px;
		margin-bottom: 24px;
	}
	.form-title { font-size: 0.9rem; font-weight: 700; margin: 0 0 12px; }
	.add-form { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
	.input {
		padding: 8px 10px;
		border: 1px solid #ddd;
		border-radius: 8px;
		font-size: 0.88rem;
	}
	.input:focus { outline: 2px solid #d56d04; border-color: transparent; }
	.input-name { flex: 2; min-width: 140px; }
	.input-num { flex: 1; min-width: 80px; }
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
	.btn-add:disabled { background: #bbb; cursor: default; }

	.table-wrap { overflow-x: auto; border: 1px solid #e8e0d8; border-radius: 14px; }
	.inv-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
	.inv-table th {
		padding: 10px 14px;
		text-align: left;
		font-size: 0.78rem;
		color: #7a6f67;
		background: #faf8f5;
		border-bottom: 1px solid #e8e0d8;
		white-space: nowrap;
	}
	.inv-table td { padding: 11px 14px; border-bottom: 1px solid #f0ede8; vertical-align: middle; }
	.inv-table tr:last-child td { border-bottom: none; }
	.col-num { text-align: right; }
	.col-actions { width: 1%; }

	.shortage-row { background: #fff7ed; }
	.shortage-num { color: #c0392b; font-weight: 700; }
	.shortage-dot {
		display: inline-flex; align-items: center; justify-content: center;
		width: 16px; height: 16px;
		background: #c0392b; color: #fff;
		font-size: 0.65rem; font-weight: 800;
		border-radius: 50%;
		margin-right: 4px; vertical-align: middle;
	}

	.action-cell { display: flex; gap: 6px; justify-content: flex-end; white-space: nowrap; }
	.btn-edit {
		padding: 5px 12px; font-size: 0.78rem;
		background: #faf8f5; border: 1px solid #e8e0d8; border-radius: 6px;
		cursor: pointer; color: #26201a;
	}
	.btn-edit:hover { border-color: #d56d04; color: #d56d04; }
	.btn-delete {
		padding: 5px 10px; font-size: 0.78rem;
		background: #fff; border: 1px solid #fca5a5; border-radius: 6px;
		cursor: pointer; color: #c0392b;
	}
	.btn-delete:hover { background: #fef2f2; }
	.edit-row { background: #fffbf5; }
	.input-inline {
		padding: 6px 8px; border: 1.5px solid #d56d04; border-radius: 6px;
		font-size: 0.85rem; width: 100%; box-sizing: border-box;
	}
	.input-inline-num { text-align: right; max-width: 80px; }
	.btn-save {
		padding: 5px 12px; background: #26201a; color: #fff;
		border: none; border-radius: 6px; font-size: 0.78rem; cursor: pointer;
	}
	.btn-cancel {
		padding: 5px 10px; background: #f0ede8; border: none;
		border-radius: 6px; font-size: 0.78rem; cursor: pointer; color: #7a6f67;
	}

	.legend {
		margin-top: 12px; font-size: 0.78rem; color: #7a6f67;
		display: flex; align-items: center; gap: 6px;
	}
</style>
