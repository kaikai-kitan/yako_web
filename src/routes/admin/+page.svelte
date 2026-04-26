<svelte:head>
	<title>管理者ダッシュボード | 微小夜行電灯</title>
</svelte:head>

<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';

	let isLoading = $state(true);
	let isAuthorized = $state(false);
	let operatorGroups = $state([]);
	let allOrders = $state([]);
	let isSettling = $state(false);
	let settleMsg = $state('');
	let settleError = $state('');
	let expandedOp = $state(null);

	const now = new Date();
	let selectedMonth = $state(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
	let filterSettlement = $state('unsettled');

	let token = $state('');

	onMount(async () => {
		const { data: { session } } = await supabase.auth.getSession();
		if (!session) {
			goto(`${base}/`);
			return;
		}
		token = session.access_token;
		await loadData();
	});

	async function loadData() {
		isLoading = true;
		settleMsg = '';
		settleError = '';

		const params = new URLSearchParams({ month: selectedMonth });
		if (filterSettlement) params.set('settlement_status', filterSettlement);

		const res = await fetch(`/api/admin/orders?${params}`, {
			headers: { Authorization: `Bearer ${token}` }
		});

		if (res.status === 401 || res.status === 403) {
			goto(`${base}/`);
			return;
		}

		isAuthorized = true;
		const data = await res.json();
		operatorGroups = data.operators ?? [];
		allOrders = data.orders ?? [];
		isLoading = false;
	}

	$effect(() => {
		selectedMonth;
		filterSettlement;
		if (token) loadData();
	});

	async function settle(orderIds) {
		isSettling = true;
		settleMsg = '';
		settleError = '';

		const res = await fetch('/api/admin/settle', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`
			},
			body: JSON.stringify({ orderIds })
		});

		isSettling = false;
		if (res.ok) {
			const d = await res.json();
			settleMsg = `${d.settled}件を精算済みにしました。`;
			await loadData();
		} else {
			settleError = `エラー: ${await res.text()}`;
		}
	}

	function formatDate(iso) {
		return new Date(iso).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
	}

	const STATUS_LABEL = { pending: '未発送', shipped: '発送済み', delivered: '受取完了' };
	const totalSales = $derived(operatorGroups.reduce((s, g) => s + g.totalSales, 0));
	const totalPayout = $derived(operatorGroups.reduce((s, g) => s + g.payout, 0));
</script>

{#if isLoading}
	<div class="loading">読み込み中...</div>
{:else}
<div class="page">
	<h1 class="page-title">管理者ダッシュボード</h1>

	<!-- フィルター -->
	<div class="filter-bar">
		<label>
			<span>月</span>
			<input type="month" bind:value={selectedMonth} />
		</label>
		<label>
			<span>精算状況</span>
			<select bind:value={filterSettlement}>
				<option value="">すべて</option>
				<option value="unsettled">未精算のみ</option>
				<option value="settled">精算済みのみ</option>
			</select>
		</label>
	</div>

	<!-- 全体サマリー -->
	<section class="section">
		<h2 class="section-title">📊 {selectedMonth} 全体集計</h2>
		<div class="stats-grid">
			<div class="stat-card">
				<span class="stat-label">出店者数</span>
				<span class="stat-value">{operatorGroups.length}社</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">総売上</span>
				<span class="stat-value">¥{totalSales.toLocaleString()}</span>
			</div>
			<div class="stat-card highlight">
				<span class="stat-label">振込合計 (90%)</span>
				<span class="stat-value">¥{totalPayout.toLocaleString()}</span>
			</div>
		</div>
		{#if settleMsg}<p class="success-msg">{settleMsg}</p>{/if}
		{#if settleError}<p class="error">{settleError}</p>{/if}
	</section>

	<!-- 出店者別精算一覧 -->
	<section class="section">
		<h2 class="section-title">💳 出店者別精算</h2>
		{#if operatorGroups.length === 0}
			<p class="empty">該当する注文はありません。</p>
		{:else}
			<div class="operator-list">
				{#each operatorGroups as group (group.operatorId)}
					<div class="op-card">
						<div class="op-header" role="button" tabindex="0"
							onclick={() => expandedOp = expandedOp === group.operatorId ? null : group.operatorId}
							onkeydown={(e) => e.key === 'Enter' && (expandedOp = expandedOp === group.operatorId ? null : group.operatorId)}>
							<div class="op-info">
								<span class="op-name">{group.businessName}</span>
								<span class="op-email">{group.email ?? '（メール未設定）'}</span>
							</div>
							<div class="op-amounts">
								<div class="amount-row">
									<span class="amount-label">売上</span>
									<span class="amount-value">¥{group.totalSales.toLocaleString()}</span>
								</div>
								<div class="amount-row">
									<span class="amount-label">手数料 10%</span>
									<span class="amount-value fee">−¥{group.fee.toLocaleString()}</span>
								</div>
								<div class="amount-row payout-row">
									<span class="amount-label">振込額 90%</span>
									<span class="amount-value payout">¥{group.payout.toLocaleString()}</span>
								</div>
							</div>
						</div>

						<div class="op-actions">
							<span class="order-count">{group.orderCount}件 ({expandedOp === group.operatorId ? '▲ 閉じる' : '▼ 注文明細'})</span>
							{#if filterSettlement !== 'settled'}
								<button
									class="btn-settle"
									disabled={isSettling || group.payout < 1000}
									onclick={() => settle(group.orders.map((o) => o.id))}
									title={group.payout < 1000 ? '振込額が1,000円未満のため翌月繰り越し' : ''}
								>
									{isSettling ? '処理中...' : group.payout < 1000 ? '振込額不足（翌月繰越）' : '精算済みにする'}
								</button>
							{/if}
						</div>

						{#if expandedOp === group.operatorId}
							<div class="order-detail">
								{#each group.orders as order (order.id)}
									<div class="detail-row">
										<span class="detail-date">{formatDate(order.created_at)}</span>
										<span class="detail-items">
											{(order.items ?? []).map((i) => `${i.name}×${i.quantity}`).join(', ')}
										</span>
										<span class="detail-amount">¥{(order.total_amount ?? 0).toLocaleString()}</span>
										<span class="detail-status">{STATUS_LABEL[order.shipping_status] ?? order.shipping_status}</span>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</section>
</div>
{/if}

<style>
	.loading {
		text-align: center;
		padding: 80px 20px;
		color: #7a6f67;
	}
	.page {
		max-width: 900px;
		margin: 0 auto;
		padding: 32px 16px 80px;
		color: #26201a;
	}
	.page-title {
		font-size: 1.3rem;
		font-weight: 700;
		margin: 0 0 24px;
		padding-bottom: 12px;
		border-bottom: 2px solid #e8e0d8;
	}
	.filter-bar {
		display: flex;
		gap: 20px;
		flex-wrap: wrap;
		margin-bottom: 28px;
	}
	.filter-bar label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.9rem;
	}
	.filter-bar input,
	.filter-bar select {
		padding: 6px 10px;
		border: 1px solid #ddd;
		border-radius: 8px;
		font-size: 0.9rem;
	}
	.section {
		margin-bottom: 40px;
	}
	.section-title {
		font-size: 1rem;
		font-weight: 700;
		margin: 0 0 16px;
		padding-bottom: 6px;
		border-bottom: 1px solid #e8e0d8;
	}
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 12px;
		margin-bottom: 16px;
	}
	.stat-card {
		background: #faf8f5;
		border: 1px solid #e8e0d8;
		border-radius: 12px;
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.stat-card.highlight {
		background: #fbf3ea;
		border-color: #d56d04;
	}
	.stat-label {
		font-size: 0.78rem;
		color: #7a6f67;
	}
	.stat-value {
		font-size: 1.25rem;
		font-weight: 700;
	}
	.empty {
		color: #9e9289;
		font-size: 0.9rem;
	}
	.operator-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.op-card {
		background: #fff;
		border: 1px solid #e8e0d8;
		border-radius: 14px;
		overflow: hidden;
	}
	.op-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 16px;
		cursor: pointer;
		gap: 16px;
		flex-wrap: wrap;
	}
	.op-header:hover {
		background: #faf8f5;
	}
	.op-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.op-name {
		font-weight: 700;
		font-size: 1rem;
	}
	.op-email {
		font-size: 0.8rem;
		color: #7a6f67;
	}
	.op-amounts {
		display: flex;
		flex-direction: column;
		gap: 4px;
		text-align: right;
	}
	.amount-row {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
		align-items: center;
	}
	.amount-label {
		font-size: 0.78rem;
		color: #7a6f67;
	}
	.amount-value {
		font-size: 0.9rem;
		font-weight: 600;
		min-width: 80px;
		text-align: right;
	}
	.amount-value.fee {
		color: #c0392b;
	}
	.payout-row {
		padding-top: 4px;
		border-top: 1px solid #e8e0d8;
	}
	.amount-value.payout {
		font-size: 1.05rem;
		color: #d56d04;
	}
	.op-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 16px;
		background: #faf8f5;
		border-top: 1px solid #f0ede8;
		flex-wrap: wrap;
		gap: 8px;
	}
	.order-count {
		font-size: 0.82rem;
		color: #7a6f67;
		cursor: pointer;
	}
	.btn-settle {
		padding: 8px 18px;
		background: #26201a;
		color: #fff;
		border: none;
		border-radius: 8px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
	}
	.btn-settle:disabled {
		background: #bbb;
		cursor: default;
	}
	.order-detail {
		border-top: 1px solid #f0ede8;
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.detail-row {
		display: flex;
		gap: 12px;
		align-items: center;
		font-size: 0.82rem;
		flex-wrap: wrap;
	}
	.detail-date {
		color: #9e9289;
		min-width: 60px;
	}
	.detail-items {
		flex: 1;
		color: #3a3028;
	}
	.detail-amount {
		font-weight: 600;
		color: #26201a;
	}
	.detail-status {
		color: #7a6f67;
		min-width: 60px;
		text-align: right;
	}
	.success-msg {
		font-size: 0.88rem;
		color: #2d8a4e;
		margin: 0;
	}
	.error {
		font-size: 0.88rem;
		color: #c0392b;
		margin: 0;
	}
</style>
