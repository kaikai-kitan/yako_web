<svelte:head>
	<title>収益ダッシュボード | YATAKARI</title>
</svelte:head>

<script>
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase.js';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';

	let userId = $state(null);
	let profile = $state(null);
	let operatorData = $state(null);
	let ownerData = $state(null);
	let isLoading = $state(true);

	const now = new Date();
	let selectedMonth = $state(
		`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
	);

	// 収益データ
	let revenueByType = $state({ yatai_usage: 0, yatai_rental: 0, land_rental: 0 });
	let shopRevenue = $state(0);
	let chartData = $state([]); // [{month, label, total}]

	// ロール判定（profile + related tables）
	let hasShopRole = $derived(!!operatorData || !!profile?.is_shop_operator);
	let hasLandRole = $derived(!!ownerData || !!profile?.is_land_owner);
	let hasYataiOwnerRole = $derived(
		!!profile?.is_yatai_owner || profile?.user_type === '屋台提供者'
	);
	let hasYataiUserRole = $derived(
		!!profile?.is_yatai_user || ['利用者', '購入者'].includes(profile?.user_type)
	);

	let totalRevenue = $derived(
		(revenueByType.yatai_usage ?? 0) +
		(revenueByType.yatai_rental ?? 0) +
		(revenueByType.land_rental ?? 0) +
		shopRevenue
	);

	// 在庫警告バッジ
	let inventoryAlert = $state(0);

	onMount(async () => {
		const {
			data: { user }
		} = await supabase.auth.getUser();
		if (!user) {
			goto(`${base}/`);
			return;
		}
		userId = user.id;
		await loadProfile(user.id);
		await Promise.all([loadRevenue(user.id), loadChart(user.id), loadInventoryAlert(user.id)]);
	});

	async function loadProfile(uid) {
		const [profileRes, opRes, ownerRes] = await Promise.all([
			supabase.from('user_profiles').select('*').eq('user_id', uid).single(),
			supabase.from('operators').select('*').eq('user_id', uid).maybeSingle(),
			supabase.from('owners').select('*').eq('user_id', uid).maybeSingle()
		]);
		profile = profileRes.data;
		operatorData = opRes.data;
		ownerData = ownerRes.data;
	}

	function monthRange(monthStr) {
		const start = `${monthStr}-01T00:00:00Z`;
		const next = new Date(`${monthStr}-01`);
		next.setMonth(next.getMonth() + 1);
		return { start, end: next.toISOString().slice(0, 10) + 'T00:00:00Z' };
	}

	async function loadRevenue(uid) {
		isLoading = true;
		const { start, end } = monthRange(selectedMonth);

		const [logsRes, ordersRes] = await Promise.all([
			supabase
				.from('revenue_logs')
				.select('revenue_type, amount')
				.eq('user_id', uid)
				.gte('occurred_at', start)
				.lt('occurred_at', end),
			operatorData
				? supabase
						.from('shop_orders')
						.select('total_amount')
						.eq('operator_id', uid)
						.gte('created_at', start)
						.lt('created_at', end)
				: Promise.resolve({ data: [] })
		]);

		const byType = { yatai_usage: 0, yatai_rental: 0, land_rental: 0 };
		for (const log of logsRes.data ?? []) {
			if (log.revenue_type in byType) byType[log.revenue_type] += log.amount;
		}
		revenueByType = byType;
		shopRevenue = (ordersRes.data ?? []).reduce((s, o) => s + (o.total_amount ?? 0), 0);

		isLoading = false;
	}

	async function loadChart(uid) {
		// 直近6ヶ月のデータを取得
		const months = Array.from({ length: 6 }, (_, i) => {
			const d = new Date();
			d.setDate(1);
			d.setMonth(d.getMonth() - (5 - i));
			return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		});

		const sixMonthsAgo = `${months[0]}-01T00:00:00Z`;

		const [allLogsRes, allOrdersRes] = await Promise.all([
			supabase
				.from('revenue_logs')
				.select('amount, occurred_at')
				.eq('user_id', uid)
				.gte('occurred_at', sixMonthsAgo),
			operatorData
				? supabase
						.from('shop_orders')
						.select('total_amount, created_at')
						.eq('operator_id', uid)
						.gte('created_at', sixMonthsAgo)
				: Promise.resolve({ data: [] })
		]);

		const totals = Object.fromEntries(months.map((m) => [m, 0]));

		for (const log of allLogsRes.data ?? []) {
			const m = log.occurred_at.slice(0, 7);
			if (m in totals) totals[m] += log.amount;
		}
		for (const o of allOrdersRes.data ?? []) {
			const m = o.created_at.slice(0, 7);
			if (m in totals) totals[m] += o.total_amount ?? 0;
		}

		chartData = months.map((m) => ({
			month: m,
			label: `${parseInt(m.slice(5))}月`,
			total: totals[m]
		}));
	}

	async function loadInventoryAlert(uid) {
		const { data } = await supabase
			.from('inventory')
			.select('required_qty, current_qty')
			.eq('user_id', uid);
		inventoryAlert = (data ?? []).filter((i) => i.required_qty > i.current_qty).length;
	}

	$effect(() => {
		const m = selectedMonth;
		if (userId && operatorData !== undefined) loadRevenue(userId);
	});

	function fmt(n) {
		return `¥${(n ?? 0).toLocaleString()}`;
	}
</script>

<div class="page">
	<div class="page-header">
		<a href="{base}/mypage" class="back-link">‹ マイページ</a>
		<h1 class="page-title">収益ダッシュボード</h1>
	</div>

	<!-- 月選択 -->
	<div class="filter-bar">
		<label class="month-label">
			<span>表示月</span>
			<input type="month" bind:value={selectedMonth} class="month-input" />
		</label>
		<a href="{base}/mypage/inventory" class="inventory-link">
			📦 在庫管理
			{#if inventoryAlert > 0}
				<span class="alert-badge">{inventoryAlert}</span>
			{/if}
		</a>
	</div>

	{#if isLoading}
		<div class="loading">読み込み中...</div>
	{:else}
		<!-- 総利益カード -->
		<div class="total-card">
			<div class="total-label">📊 {selectedMonth} 総利益</div>
			<div class="total-value">{fmt(totalRevenue)}</div>
			<div class="total-sub">すべてのロールの合計収益</div>
		</div>

		<!-- ロール別カード -->
		<div class="role-grid">
			{#if hasYataiUserRole}
				<div class="role-card yatai-user">
					<div class="role-header">
						<span class="role-icon">🍜</span>
						<div>
							<div class="role-name">屋台利用者</div>
							<div class="role-desc">屋台販売売上</div>
						</div>
					</div>
					<div class="role-amount">{fmt(revenueByType.yatai_usage)}</div>
					<div class="role-bar">
						<div
							class="bar-fill yatai-user-fill"
							style="width: {totalRevenue > 0 ? Math.round((revenueByType.yatai_usage / totalRevenue) * 100) : 0}%"
						></div>
					</div>
				</div>
			{/if}

			{#if hasYataiOwnerRole}
				<div class="role-card yatai-owner">
					<div class="role-header">
						<span class="role-icon">🏮</span>
						<div>
							<div class="role-name">屋台主</div>
							<div class="role-desc">屋台貸し出し収益</div>
						</div>
					</div>
					<div class="role-amount">{fmt(revenueByType.yatai_rental)}</div>
					<div class="role-bar">
						<div
							class="bar-fill yatai-owner-fill"
							style="width: {totalRevenue > 0 ? Math.round((revenueByType.yatai_rental / totalRevenue) * 100) : 0}%"
						></div>
					</div>
				</div>
			{/if}

			{#if hasLandRole}
				<div class="role-card land-owner">
					<div class="role-header">
						<span class="role-icon">🏡</span>
						<div>
							<div class="role-name">土地主</div>
							<div class="role-desc">土地利用収益</div>
						</div>
					</div>
					<div class="role-amount">{fmt(revenueByType.land_rental)}</div>
					<div class="role-bar">
						<div
							class="bar-fill land-fill"
							style="width: {totalRevenue > 0 ? Math.round((revenueByType.land_rental / totalRevenue) * 100) : 0}%"
						></div>
					</div>
				</div>
			{/if}

			{#if hasShopRole}
				<div class="role-card shop-op">
					<div class="role-header">
						<span class="role-icon">🛍️</span>
						<div>
							<div class="role-name">ショップ運営者</div>
							<div class="role-desc">オンラインストア売上</div>
						</div>
					</div>
					<div class="role-amount">{fmt(shopRevenue)}</div>
					<div class="role-bar">
						<div
							class="bar-fill shop-fill"
							style="width: {totalRevenue > 0 ? Math.round((shopRevenue / totalRevenue) * 100) : 0}%"
						></div>
					</div>
					<a href="{base}/mypage/operator" class="role-link">詳細・精算管理 ›</a>
				</div>
			{/if}
		</div>

		{#if !hasYataiUserRole && !hasYataiOwnerRole && !hasLandRole && !hasShopRole}
			<div class="no-role">
				<p>収益を表示するためのロールが設定されていません。</p>
				<a href="{base}/mypage" class="no-role-link">マイページでロールを追加する ›</a>
			</div>
		{/if}

		<!-- 6ヶ月売上推移チャート -->
		{#if chartData.length > 0}
			<div class="chart-section">
				<h2 class="section-title">📈 売上推移（直近6ヶ月）</h2>
				{@const maxVal = Math.max(...chartData.map((d) => d.total), 1)}
				<div class="chart-wrap">
					<svg
						class="chart-svg"
						viewBox="0 0 {chartData.length * 72} 140"
						preserveAspectRatio="xMidYMid meet"
					>
						{#each chartData as point, i}
							{@const barH = Math.max(Math.round((point.total / maxVal) * 100), point.total > 0 ? 4 : 0)}
							{@const isCurrentMonth = point.month === selectedMonth}
							<rect
								x={i * 72 + 10}
								y={100 - barH}
								width="52"
								height={barH}
								fill={isCurrentMonth ? '#d56d04' : '#e8c97a'}
								rx="5"
							/>
							{#if point.total > 0}
								<text
									x={i * 72 + 36}
									y={94 - barH}
									text-anchor="middle"
									font-size="9"
									fill="#26201a"
								>
									{point.total >= 1000
										? `¥${Math.round(point.total / 1000)}K`
										: `¥${point.total}`}
								</text>
							{/if}
							<text
								x={i * 72 + 36}
								y="116"
								text-anchor="middle"
								font-size="11"
								fill={isCurrentMonth ? '#d56d04' : '#7a6f67'}
								font-weight={isCurrentMonth ? '700' : '400'}
							>
								{point.label}
							</text>
						{/each}
					</svg>
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.page {
		max-width: 720px;
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
	.filter-bar {
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
		margin-bottom: 24px;
	}
	.month-label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.88rem;
		color: #7a6f67;
	}
	.month-input {
		padding: 6px 10px;
		border: 1px solid #ddd;
		border-radius: 8px;
		font-size: 0.88rem;
	}
	.inventory-link {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 7px 14px;
		background: #faf8f5;
		border: 1px solid #e8e0d8;
		border-radius: 10px;
		font-size: 0.85rem;
		color: #26201a;
		text-decoration: none;
		margin-left: auto;
	}
	.inventory-link:hover {
		border-color: #d56d04;
		color: #d56d04;
	}
	.alert-badge {
		background: #c0392b;
		color: #fff;
		font-size: 0.72rem;
		font-weight: 700;
		padding: 1px 6px;
		border-radius: 999px;
	}
	.loading {
		text-align: center;
		padding: 60px;
		color: #7a6f67;
	}

	/* 総利益 */
	.total-card {
		background: #26201a;
		color: #fff;
		border-radius: 18px;
		padding: 28px 24px;
		margin-bottom: 24px;
		text-align: center;
	}
	.total-label {
		font-size: 0.85rem;
		color: #b5a99e;
		margin-bottom: 8px;
	}
	.total-value {
		font-size: 2.4rem;
		font-weight: 800;
		letter-spacing: -0.5px;
		color: #e8c97a;
	}
	.total-sub {
		font-size: 0.75rem;
		color: #7a6f67;
		margin-top: 6px;
	}

	/* ロールカード */
	.role-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 14px;
		margin-bottom: 32px;
	}
	.role-card {
		background: #fff;
		border: 1.5px solid #e8e0d8;
		border-radius: 14px;
		padding: 18px 20px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.role-header {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.role-icon {
		font-size: 1.6rem;
	}
	.role-name {
		font-size: 0.9rem;
		font-weight: 700;
	}
	.role-desc {
		font-size: 0.75rem;
		color: #7a6f67;
	}
	.role-amount {
		font-size: 1.6rem;
		font-weight: 800;
	}
	.role-bar {
		height: 6px;
		background: #f0ede8;
		border-radius: 3px;
		overflow: hidden;
	}
	.bar-fill {
		height: 100%;
		border-radius: 3px;
		transition: width 0.4s ease;
		min-width: 0;
	}
	.yatai-user-fill { background: #3b82f6; }
	.yatai-owner-fill { background: #f59e0b; }
	.land-fill { background: #22c55e; }
	.shop-fill { background: #d56d04; }

	.yatai-user { border-color: #bfdbfe; }
	.yatai-owner { border-color: #fde68a; }
	.land-owner { border-color: #bbf7d0; }
	.shop-op { border-color: #fed7aa; }

	.role-link {
		font-size: 0.78rem;
		color: #d56d04;
		text-decoration: none;
		align-self: flex-end;
	}
	.role-link:hover { text-decoration: underline; }

	.no-role {
		text-align: center;
		padding: 40px 20px;
		color: #7a6f67;
		font-size: 0.9rem;
	}
	.no-role-link {
		display: inline-block;
		margin-top: 12px;
		color: #d56d04;
		text-decoration: none;
		font-weight: 600;
	}

	/* チャート */
	.chart-section {
		margin-top: 8px;
	}
	.section-title {
		font-size: 0.95rem;
		font-weight: 700;
		margin: 0 0 14px;
		padding-bottom: 6px;
		border-bottom: 1px solid #e8e0d8;
	}
	.chart-wrap {
		background: #faf8f5;
		border: 1px solid #e8e0d8;
		border-radius: 14px;
		padding: 16px 8px 8px;
		overflow-x: auto;
	}
	.chart-svg {
		display: block;
		width: 100%;
		min-width: 360px;
		height: auto;
	}
</style>
