<svelte:head>
	<title>ダッシュボード | YATAKARI</title>
</svelte:head>

<script>
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase.js';
	import { getMyStalls } from '$lib/db.js';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';

	let userId = $state(null);
	let profile = $state(null);
	let operatorData = $state(null);
	let ownerData = $state(null);
	let isLoading = $state(true);
	let section = $state('revenue'); // 'revenue' | 'inventory'

	const now = new Date();
	let selectedMonth = $state(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

	// 収益データ
	let revenueByType = $state({ yatai_usage: 0, yatai_rental: 0, land_rental: 0 });
	let shopRevenue = $state(0);
	let orderCount = $state(0);
	let chartData = $state([]);
	let myStalls = $state([]);

	// 在庫データ
	let menuItems = $state([]);
	let invItems = $state([]);
	let ingredients = $state([]);
	let invMsg = $state('');
	let invErr = $state('');

	// ロール判定
	let hasShopRole = $derived(!!operatorData || !!profile?.is_shop_operator);
	let hasLandRole = $derived(!!ownerData || !!profile?.is_land_owner);
	let hasYataiOwnerRole = $derived(!!profile?.is_yatai_owner || profile?.user_type === '屋台提供者');
	let hasYataiUserRole = $derived(!!profile?.is_yatai_user || ['利用者', '購入者'].includes(profile?.user_type));
	let hasAnyRole = $derived(hasYataiUserRole || hasYataiOwnerRole || hasLandRole || hasShopRole);

	let totalRevenue = $derived(
		(revenueByType.yatai_usage ?? 0) + (revenueByType.yatai_rental ?? 0) +
		(revenueByType.land_rental ?? 0) + shopRevenue
	);

	const ROLE_META = {
		yatai_usage:  { label: '屋台利用者', desc: '屋台販売売上',         color: '#2a78d6' },
		yatai_rental: { label: '屋台主',     desc: '屋台貸し出し収益',     color: '#eb6834' },
		land_rental:  { label: '土地主',     desc: '土地利用収益',         color: '#1baf7a' },
		shop:         { label: 'ショップ',   desc: 'オンラインストア売上', color: '#eda100' }
	};
	let breakdown = $derived([
		hasYataiUserRole  && { ...ROLE_META.yatai_usage,  amount: revenueByType.yatai_usage ?? 0 },
		hasYataiOwnerRole && { ...ROLE_META.yatai_rental, amount: revenueByType.yatai_rental ?? 0 },
		hasLandRole       && { ...ROLE_META.land_rental,  amount: revenueByType.land_rental ?? 0 },
		hasShopRole       && { ...ROLE_META.shop,         amount: shopRevenue }
	].filter(Boolean));

	let deltaPct = $derived.by(() => {
		const idx = chartData.findIndex((d) => d.month === selectedMonth);
		if (idx <= 0) return null;
		const cur = chartData[idx].total, prev = chartData[idx - 1].total;
		if (prev <= 0) return null;
		return Math.round(((cur - prev) / prev) * 100);
	});

	// ── 在庫サマリー ──
	let shortageItems = $derived(invItems.filter((i) => i.required_qty > i.current_qty).length);
	let totalNeeded = $derived(invItems.reduce((s, i) => s + Math.max(0, i.required_qty - i.current_qty) * i.unit_price, 0));

	// ── 見込み利益（現在の在庫で作れる数 × 1食あたり利益） ──
	let profitByMenu = $derived.by(() => {
		const invById = Object.fromEntries(invItems.map((i) => [i.id, i]));
		const byMenu = {};
		for (const ing of ingredients) (byMenu[ing.menu_item_id] ??= []).push(ing);
		return menuItems.map((menu) => {
			const ings = (byMenu[menu.id] ?? []).filter(
				(ing) => ing.inventory_item_id && invById[ing.inventory_item_id] && ing.qty_per_serving > 0
			);
			if (ings.length === 0) return { menu, configured: false };
			let servings = Infinity, bottleneck = null, costPerServing = 0;
			for (const ing of ings) {
				const inv = invById[ing.inventory_item_id];
				const s = Math.floor((inv.current_qty ?? 0) / ing.qty_per_serving);
				if (s < servings) { servings = s; bottleneck = inv.name; }
				costPerServing += ing.qty_per_serving * (inv.unit_price ?? 0);
			}
			if (!isFinite(servings)) servings = 0;
			const profitPerServing = (menu.price ?? 0) - costPerServing;
			return {
				menu, configured: true, servings, bottleneck, costPerServing, profitPerServing,
				projectedProfit: servings * profitPerServing,
				projectedRevenue: servings * (menu.price ?? 0)
			};
		});
	});
	let configuredMenus = $derived(profitByMenu.filter((m) => m.configured));
	let totalProjectedProfit = $derived(configuredMenus.reduce((s, m) => s + m.projectedProfit, 0));
	let totalProjectedRevenue = $derived(configuredMenus.reduce((s, m) => s + m.projectedRevenue, 0));

	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) { goto(`${base}/`); return; }
		userId = user.id;
		await loadProfile(user.id);
		await Promise.all([
			loadRevenue(user.id), loadChart(user.id), loadMyStalls(user.id),
			loadMenu(user.id), loadInv(user.id), loadIngredients(user.id)
		]);
	});

	async function loadMyStalls(uid) { try { myStalls = await getMyStalls(uid); } catch { myStalls = []; } }

	async function loadProfile(uid) {
		const [profileRes, opRes, ownerRes] = await Promise.all([
			supabase.from('user_profiles').select('*').eq('user_id', uid).single(),
			supabase.from('operators').select('*').eq('user_id', uid).maybeSingle(),
			supabase.from('owners').select('*').eq('user_id', uid).maybeSingle()
		]);
		profile = profileRes.data; operatorData = opRes.data; ownerData = ownerRes.data;
	}

	function monthRange(monthStr) {
		const start = `${monthStr}-01T00:00:00Z`;
		const next = new Date(`${monthStr}-01`); next.setMonth(next.getMonth() + 1);
		return { start, end: next.toISOString().slice(0, 10) + 'T00:00:00Z' };
	}

	async function loadRevenue(uid) {
		isLoading = true;
		const { start, end } = monthRange(selectedMonth);
		const [logsRes, ordersRes] = await Promise.all([
			supabase.from('revenue_logs').select('revenue_type, amount').eq('user_id', uid).gte('occurred_at', start).lt('occurred_at', end),
			operatorData
				? supabase.from('shop_orders').select('total_amount').eq('operator_id', uid).gte('created_at', start).lt('created_at', end)
				: Promise.resolve({ data: [] })
		]);
		const byType = { yatai_usage: 0, yatai_rental: 0, land_rental: 0 };
		for (const log of logsRes.data ?? []) if (log.revenue_type in byType) byType[log.revenue_type] += log.amount;
		revenueByType = byType;
		const orders = ordersRes.data ?? [];
		shopRevenue = orders.reduce((s, o) => s + (o.total_amount ?? 0), 0);
		orderCount = orders.length;
		isLoading = false;
	}

	async function loadChart(uid) {
		const months = Array.from({ length: 6 }, (_, i) => {
			const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i));
			return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		});
		const sixMonthsAgo = `${months[0]}-01T00:00:00Z`;
		const [allLogsRes, allOrdersRes] = await Promise.all([
			supabase.from('revenue_logs').select('amount, occurred_at').eq('user_id', uid).gte('occurred_at', sixMonthsAgo),
			operatorData
				? supabase.from('shop_orders').select('total_amount, created_at').eq('operator_id', uid).gte('created_at', sixMonthsAgo)
				: Promise.resolve({ data: [] })
		]);
		const totals = Object.fromEntries(months.map((m) => [m, 0]));
		for (const log of allLogsRes.data ?? []) { const m = log.occurred_at.slice(0, 7); if (m in totals) totals[m] += log.amount; }
		for (const o of allOrdersRes.data ?? []) { const m = o.created_at.slice(0, 7); if (m in totals) totals[m] += o.total_amount ?? 0; }
		chartData = months.map((m) => ({ month: m, label: `${parseInt(m.slice(5))}月`, total: totals[m] }));
	}

	async function loadMenu(uid) {
		const { data } = await supabase.from('my_menu_items').select('id, name, price').eq('user_id', uid).order('display_order', { ascending: true });
		menuItems = data ?? [];
	}
	async function loadInv(uid) {
		const { data } = await supabase.from('inventory').select('*').eq('user_id', uid).order('created_at', { ascending: true });
		invItems = data ?? [];
	}
	async function loadIngredients(uid) {
		const { data } = await supabase.from('menu_ingredients').select('menu_item_id, inventory_item_id, qty_per_serving, item_type').eq('user_id', uid);
		ingredients = data ?? [];
	}

	$effect(() => { selectedMonth; if (userId && operatorData !== undefined) loadRevenue(userId); });

	function fmt(n) { return `¥${Math.round(n ?? 0).toLocaleString()}`; }
	function fmtShort(n) {
		if (n >= 1_000_000) return `¥${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
		if (n >= 1000) return `¥${Math.round(n / 1000)}K`;
		return `¥${Math.round(n)}`;
	}

	// ── チャート座標 ──
	const CW = 620, CH = 210, padL = 46, padR = 16, padT = 16, padB = 34;
	const plotW = CW - padL - padR, plotH = CH - padT - padB;
	function niceMax(v) {
		if (v <= 0) return 1;
		const p = Math.pow(10, Math.floor(Math.log10(v)));
		const n = v / p; const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
		return step * p;
	}
	let axisMax = $derived(niceMax(Math.max(...chartData.map((d) => d.total), 1)));
	let pts = $derived(chartData.map((d, i) => ({
		...d, i,
		x: padL + (chartData.length === 1 ? plotW / 2 : (i * plotW) / (chartData.length - 1)),
		y: padT + plotH - (d.total / axisMax) * plotH
	})));
	let linePath = $derived(pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '));
	let areaPath = $derived(pts.length ? `${linePath} L ${pts.at(-1).x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z` : '');
	let gridLines = $derived([0, 0.5, 1].map((g) => ({ v: axisMax * g, y: padT + plotH - g * plotH })));
	let hoverIdx = $state(null);
	let chartEl = $state();
	function onChartMove(e) {
		if (!chartEl || pts.length === 0) return;
		const rect = chartEl.getBoundingClientRect();
		const xVb = (e.clientX - rect.left) * (CW / rect.width);
		const step = chartData.length > 1 ? plotW / (chartData.length - 1) : plotW;
		hoverIdx = Math.max(0, Math.min(chartData.length - 1, Math.round((xVb - padL) / step)));
	}
	function onChartLeave() { hoverIdx = null; }
	let hover = $derived(hoverIdx != null ? pts[hoverIdx] : null);

	// ── 在庫 CRUD ──
	let newName = $state(''), newUnitPrice = $state(''), newRequired = $state(''), newCurrent = $state('');
	let isAdding = $state(false);
	let editingId = $state(null);
	let editName = $state(''), editUnitPrice = $state(''), editRequired = $state(''), editCurrent = $state('');
	let isSaving = $state(false);

	function invFlash(m) { invMsg = m; setTimeout(() => (invMsg = ''), 2500); }

	async function addInvItem() {
		if (!newName.trim()) return;
		isAdding = true; invErr = '';
		const { error } = await supabase.from('inventory').insert({
			user_id: userId, name: newName.trim(),
			unit_price: parseInt(newUnitPrice) || 0, required_qty: parseInt(newRequired) || 0, current_qty: parseInt(newCurrent) || 0
		});
		if (error) invErr = '追加に失敗しました: ' + error.message;
		else { newName = ''; newUnitPrice = ''; newRequired = ''; newCurrent = ''; invFlash('追加しました'); await loadInv(userId); }
		isAdding = false;
	}
	function startEdit(it) { editingId = it.id; editName = it.name; editUnitPrice = String(it.unit_price); editRequired = String(it.required_qty); editCurrent = String(it.current_qty); }
	function cancelEdit() { editingId = null; }
	async function saveEdit(id) {
		isSaving = true; invErr = '';
		const { error } = await supabase.from('inventory').update({
			name: editName.trim(), unit_price: parseInt(editUnitPrice) || 0, required_qty: parseInt(editRequired) || 0, current_qty: parseInt(editCurrent) || 0
		}).eq('id', id).eq('user_id', userId);
		if (error) invErr = '更新に失敗しました: ' + error.message;
		else { editingId = null; invFlash('更新しました'); await loadInv(userId); }
		isSaving = false;
	}
	async function deleteInvItem(id) {
		if (!confirm('この商品を削除しますか？\n（このアイテムを参照するメニュー紐付けも解除されます）')) return;
		const { error } = await supabase.from('inventory').delete().eq('id', id).eq('user_id', userId);
		if (!error) { invFlash('削除しました'); await Promise.all([loadInv(userId), loadIngredients(userId)]); }
	}
	// 現在数のクイック増減
	async function bumpStock(it, delta) {
		const next = Math.max(0, (it.current_qty ?? 0) + delta);
		const { error } = await supabase.from('inventory').update({ current_qty: next }).eq('id', it.id).eq('user_id', userId);
		if (!error) await loadInv(userId);
	}
</script>

<div class="page">
	<header class="page-header">
		<a href="{base}/mypage" class="back-link">‹ マイページ</a>
		<h1 class="page-title">ダッシュボード</h1>
	</header>

	<!-- セクション切替 -->
	<div class="seg">
		<button class="seg-btn" class:active={section === 'revenue'} onclick={() => (section = 'revenue')}>
			<Icon name="bar-chart" size={16} /> 収益
		</button>
		<button class="seg-btn" class:active={section === 'inventory'} onclick={() => (section = 'inventory')}>
			<Icon name="package" size={16} /> 在庫
			{#if shortageItems > 0}<span class="seg-badge">{shortageItems}</span>{/if}
		</button>
	</div>

	{#if isLoading}
		<div class="loading">読み込み中…</div>

	<!-- ===== 収益 ===== -->
	{:else if section === 'revenue'}
		{#if !hasAnyRole}
			<div class="empty-box">
				<p>収益を表示するためのロールが設定されていません。</p>
				<a href="{base}/mypage" class="link-strong">マイページでロールを追加する ›</a>
			</div>
		{:else}
			<div class="toolbar">
				<label class="field-inline"><span>表示月</span>
					<input type="month" bind:value={selectedMonth} class="month-input" />
				</label>
			</div>

			<section class="analytics">
				<p class="metric-label">総利益</p>
				<p class="metric-value">{fmt(totalRevenue)}</p>
				<p class="metric-sub">
					<span class="metric-month">{selectedMonth}</span>
					{#if deltaPct != null}
						<span class="delta" class:up={deltaPct >= 0} class:down={deltaPct < 0}>
							{deltaPct >= 0 ? '▲' : '▼'} {Math.abs(deltaPct)}% <span class="delta-note">前月比</span>
						</span>
					{/if}
				</p>

				<figure class="chart">
					<figcaption class="chart-cap">総利益の推移（直近6ヶ月）</figcaption>
					<div class="chart-holder">
						<svg bind:this={chartEl} viewBox="0 0 {CW} {CH}" class="chart-svg" onpointermove={onChartMove} onpointerleave={onChartLeave} role="presentation">
							<defs>
								<linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stop-color="var(--accent)" stop-opacity="0.22" />
									<stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
								</linearGradient>
							</defs>
							{#each gridLines as g}
								<line x1={padL} x2={CW - padR} y1={g.y} y2={g.y} class="grid" />
								<text x={padL - 8} y={g.y + 3} text-anchor="end" class="axis-y">{fmtShort(g.v)}</text>
							{/each}
							<path d={areaPath} fill="url(#area-grad)" />
							<path d={linePath} class="line" />
							{#if hover}<line x1={hover.x} x2={hover.x} y1={padT} y2={padT + plotH} class="crosshair" />{/if}
							{#each pts as p}
								<circle cx={p.x} cy={p.y} r={hoverIdx === p.i ? 5 : (p.i === pts.length - 1 ? 4 : 3)} class="dot" class:emph={p.i === pts.length - 1 || hoverIdx === p.i} />
							{/each}
							{#each pts as p}
								<text x={p.x} y={CH - 12} text-anchor="middle" class="axis-x" class:cur={p.month === selectedMonth}>{p.label}</text>
							{/each}
						</svg>
						{#if hover}
							<div class="tooltip" style="left: {(hover.x / CW) * 100}%; top: {(hover.y / CH) * 100}%">
								<span class="tt-month">{hover.month.replace('-', '年')}月</span>
								<span class="tt-val">{fmt(hover.total)}</span>
							</div>
						{/if}
					</div>
				</figure>
			</section>

			{#if hasShopRole}
				<section class="kpis">
					<div class="kpi"><span class="kpi-label">ショップ売上</span><span class="kpi-value">{fmt(shopRevenue)}</span></div>
					<div class="kpi"><span class="kpi-label">注文数</span><span class="kpi-value">{orderCount}<span class="kpi-unit">件</span></span></div>
					<div class="kpi"><span class="kpi-label">平均注文額</span><span class="kpi-value">{fmt(orderCount > 0 ? shopRevenue / orderCount : 0)}</span></div>
					<div class="kpi" class:warn={shortageItems > 0}><span class="kpi-label">在庫アラート</span><span class="kpi-value">{shortageItems}<span class="kpi-unit">件</span></span></div>
				</section>
			{/if}

			<section class="card">
				<div class="card-head"><h2 class="card-title">収益の内訳</h2><span class="card-sub">{selectedMonth}</span></div>
				<ul class="bd-list">
					{#each breakdown as b}
						{@const share = totalRevenue > 0 ? (b.amount / totalRevenue) * 100 : 0}
						<li class="bd-row">
							<span class="bd-chip" style="background:{b.color}"></span>
							<div class="bd-main">
								<div class="bd-top"><span class="bd-name">{b.label}</span><span class="bd-amount">{fmt(b.amount)}</span></div>
								<div class="bd-bar"><div class="bd-fill" style="width:{share}%; background:{b.color}"></div></div>
								<div class="bd-meta"><span class="bd-desc">{b.desc}</span><span class="bd-share">{share.toFixed(0)}%</span></div>
							</div>
						</li>
					{/each}
				</ul>
				{#if hasShopRole}<a href="{base}/mypage/operator" class="card-foot-link">ショップの詳細・精算管理 ›</a>{/if}
			</section>

			{#if myStalls.length > 0}
				<section class="card">
					<div class="card-head"><h2 class="card-title">夜行人ネットワーク 接続タグ</h2></div>
					<p class="tag-lead">屋台に QR / NFC タグを設置すると、来場者がスマホをかざすだけで<a href="{base}/network">夜行人ネットワーク</a>につながります。</p>
					<div class="tag-list">
						{#each myStalls as stall}
							<a href="{base}/yakonin/tag/{stall.id}" class="tag-row">
								<span class="tag-name"><Icon name="qr-code" size={16} /> {stall.stall_name ?? '屋台'}</span>
								<span class="tag-cta">接続タグを発行 ›</span>
							</a>
						{/each}
					</div>
				</section>
			{/if}
		{/if}

	<!-- ===== 在庫 ===== -->
	{:else}
		{#if invMsg}<p class="ok-msg">{invMsg}</p>{/if}
		{#if invErr}<p class="err-msg">{invErr}</p>{/if}

		<!-- サマリー -->
		<section class="kpis">
			<div class="kpi"><span class="kpi-label">登録商品</span><span class="kpi-value">{invItems.length}<span class="kpi-unit">件</span></span></div>
			<div class="kpi" class:warn={shortageItems > 0}><span class="kpi-label">不足商品</span><span class="kpi-value">{shortageItems}<span class="kpi-unit">件</span></span></div>
			<div class="kpi" class:warn={totalNeeded > 0}><span class="kpi-label">必要資金</span><span class="kpi-value">{fmt(totalNeeded)}</span></div>
		</section>

		<!-- 見込み利益 -->
		<section class="analytics">
			<p class="metric-label">見込み利益 <span class="metric-hint">今の在庫で作れる分</span></p>
			<p class="metric-value" class:pos={totalProjectedProfit > 0} class:neg={totalProjectedProfit < 0}>{fmt(totalProjectedProfit)}</p>
			<p class="metric-sub">
				<span>売上見込 {fmt(totalProjectedRevenue)}</span>
				{#if configuredMenus.length}<span class="metric-month">・ {configuredMenus.length}メニュー</span>{/if}
			</p>

			{#if configuredMenus.length === 0}
				<div class="hint-box">
					メニューに食材・消耗品を紐付けると、<b>今の在庫であと何食作れて、いくら利益が見込めるか</b>を自動で計算します。
					<a href="{base}/mypage/inventory" class="link-strong">メニューと食材を紐付ける ›</a>
				</div>
			{:else}
				<ul class="proj-list">
					{#each configuredMenus as m}
						<li class="proj-row">
							<div class="proj-main">
								<span class="proj-name">{m.menu.name}</span>
								<span class="proj-servings">あと <b>{m.servings}</b> 食</span>
							</div>
							<div class="proj-side">
								<span class="proj-profit" class:pos={m.projectedProfit > 0} class:neg={m.projectedProfit < 0}>{fmt(m.projectedProfit)}</span>
								{#if m.servings === 0 && m.bottleneck}
									<span class="proj-bottleneck"><Icon name="alert-triangle" size={12} /> {m.bottleneck} 切れ</span>
								{:else if m.bottleneck}
									<span class="proj-bottleneck muted">{m.bottleneck}で頭打ち</span>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
				<a href="{base}/mypage/inventory" class="card-foot-link">メニューと食材の紐付けを編集 ›</a>
			{/if}
		</section>

		<!-- 在庫の追加 -->
		<section class="card">
			<div class="card-head"><h2 class="card-title">在庫アイテムを追加</h2></div>
			<div class="add-form">
				<input type="text" bind:value={newName} placeholder="商品名（例：紙トレイ、鴨肉）" class="inp inp-name" />
				<input type="number" bind:value={newUnitPrice} placeholder="単価" class="inp inp-num" min="0" />
				<input type="number" bind:value={newRequired} placeholder="必要数" class="inp inp-num" min="0" />
				<input type="number" bind:value={newCurrent} placeholder="現在数" class="inp inp-num" min="0" />
				<button class="btn-primary" onclick={addInvItem} disabled={isAdding || !newName.trim()}>{isAdding ? '追加中…' : '追加'}</button>
			</div>
		</section>

		<!-- 在庫一覧 -->
		<section class="card">
			<div class="card-head"><h2 class="card-title">在庫一覧</h2></div>
			{#if invItems.length === 0}
				<p class="empty-inline">在庫データがありません。上のフォームから追加してください。</p>
			{:else}
				<div class="table-wrap">
					<table class="inv-table">
						<thead><tr>
							<th class="c-name">商品名</th><th class="c-num">単価</th><th class="c-num">必要</th>
							<th class="c-num">現在</th><th class="c-num">不足</th><th class="c-num">必要資金</th><th></th>
						</tr></thead>
						<tbody>
							{#each invItems as it (it.id)}
								{@const short = it.required_qty - it.current_qty}
								{@const needs = Math.max(0, short) * it.unit_price}
								{#if editingId === it.id}
									<tr class="edit-row">
										<td><input type="text" bind:value={editName} class="inp-inline" /></td>
										<td><input type="number" bind:value={editUnitPrice} class="inp-inline num" min="0" /></td>
										<td><input type="number" bind:value={editRequired} class="inp-inline num" min="0" /></td>
										<td><input type="number" bind:value={editCurrent} class="inp-inline num" min="0" /></td>
										<td colspan="2"></td>
										<td class="c-act">
											<button class="mini-btn dark" onclick={() => saveEdit(it.id)} disabled={isSaving}>{isSaving ? '…' : '保存'}</button>
											<button class="mini-btn" onclick={cancelEdit}>取消</button>
										</td>
									</tr>
								{:else}
									<tr class:short-row={short > 0}>
										<td class="c-name">{#if short > 0}<span class="dot">!</span>{/if}{it.name}</td>
										<td class="c-num">{fmt(it.unit_price)}</td>
										<td class="c-num">{it.required_qty}</td>
										<td class="c-num">
											<span class="stepper">
												<button class="step" aria-label="減らす" onclick={() => bumpStock(it, -1)}>−</button>
												<span class="step-val">{it.current_qty}</span>
												<button class="step" aria-label="増やす" onclick={() => bumpStock(it, 1)}>＋</button>
											</span>
										</td>
										<td class="c-num" class:short-num={short > 0}>{short > 0 ? `−${short}` : '—'}</td>
										<td class="c-num" class:short-num={needs > 0}>{needs > 0 ? fmt(needs) : '—'}</td>
										<td class="c-act">
											<button class="mini-btn" onclick={() => startEdit(it)}>編集</button>
											<button class="mini-btn danger" onclick={() => deleteInvItem(it.id)}>削除</button>
										</td>
									</tr>
								{/if}
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>
	{/if}
</div>

<style>
	.page { max-width: 820px; margin: 0 auto; padding: 22px 16px 80px; color: var(--ink); }

	.page-header { margin-bottom: 16px; }
	.back-link { font-size: 0.82rem; color: var(--ink-2); text-decoration: none; }
	.back-link:hover { color: var(--accent); }
	.page-title { font-size: 1.35rem; font-weight: 700; margin: 6px 0 0; }

	/* セグメント */
	.seg { display: inline-flex; gap: 4px; background: var(--surface-sunk); border-radius: 11px; padding: 4px; margin-bottom: 20px; }
	.seg-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; border: none; background: transparent; border-radius: 8px; font-size: 0.86rem; font-weight: 600; color: var(--ink-2); cursor: pointer; font-family: inherit; }
	.seg-btn :global(.icon) { color: currentColor; }
	.seg-btn.active { background: var(--surface); color: var(--ink); box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
	.seg-badge { background: var(--accent-deep); color: #fff; font-size: 0.66rem; font-weight: 700; padding: 1px 6px; border-radius: 999px; }

	.loading { text-align: center; padding: 60px; color: var(--ink-2); }
	.empty-box { text-align: center; padding: 48px 20px; color: var(--ink-2); font-size: 0.9rem; }
	.link-strong { display: inline-block; margin-top: 10px; color: var(--accent); text-decoration: none; font-weight: 600; }
	.ok-msg { font-size: 0.84rem; color: #1a8a4f; margin: 0 0 12px; }
	.err-msg { font-size: 0.84rem; color: var(--accent-deep); margin: 0 0 12px; }

	.toolbar { margin-bottom: 14px; }
	.field-inline { display: inline-flex; align-items: center; gap: 8px; font-size: 0.84rem; color: var(--ink-2); }
	.month-input { padding: 7px 11px; border: 1px solid var(--line-strong); border-radius: 9px; font-size: 0.85rem; font-family: inherit; background: var(--surface); color: var(--ink); }
	.month-input:focus { outline: 2px solid var(--accent); border-color: transparent; }

	/* 分析サマリー */
	.analytics { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 22px 22px 18px; box-shadow: var(--shadow-1); margin-bottom: 16px; }
	.metric-label { font-size: 0.8rem; color: var(--ink-2); margin: 0 0 4px; display: flex; align-items: baseline; gap: 8px; }
	.metric-hint { font-size: 0.7rem; color: var(--ink-3); font-weight: 400; }
	.metric-value { font-size: 2.5rem; font-weight: 800; letter-spacing: -0.02em; margin: 0; color: var(--ink); font-variant-numeric: tabular-nums; line-height: 1.05; }
	.metric-value.pos { color: #1a8a4f; }
	.metric-value.neg { color: var(--accent-deep); }
	.metric-sub { display: flex; align-items: center; gap: 12px; margin: 8px 0 0; font-size: 0.82rem; color: var(--ink-3); }
	.metric-month { font-variant-numeric: tabular-nums; }
	.delta { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; font-variant-numeric: tabular-nums; }
	.delta.up { color: #1a8a4f; }
	.delta.down { color: var(--accent-deep); }
	.delta-note { color: var(--ink-3); font-weight: 500; margin-left: 2px; }

	.chart { margin: 18px 0 0; }
	.chart-cap { font-size: 0.76rem; color: var(--ink-3); margin: 0 0 6px; }
	.chart-holder { position: relative; width: 100%; }
	.chart-svg { display: block; width: 100%; height: auto; touch-action: none; }
	.grid { stroke: var(--line); stroke-width: 1; }
	.axis-y { fill: var(--ink-3); font-size: 10px; font-family: inherit; }
	.axis-x { fill: var(--ink-3); font-size: 11px; font-family: inherit; }
	.axis-x.cur { fill: var(--accent); font-weight: 700; }
	.line { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
	.dot { fill: var(--surface); stroke: var(--accent); stroke-width: 2; }
	.dot.emph { fill: var(--accent); }
	.crosshair { stroke: var(--accent); stroke-width: 1; stroke-dasharray: 3 3; opacity: 0.5; }
	.tooltip { position: absolute; transform: translate(-50%, -125%); background: var(--ink); color: #fff; border-radius: 8px; padding: 6px 10px; font-size: 0.74rem; white-space: nowrap; pointer-events: none; display: flex; flex-direction: column; gap: 1px; box-shadow: var(--shadow-2); }
	.tt-month { color: #cdbfae; font-size: 0.66rem; }
	.tt-val { font-weight: 700; font-variant-numeric: tabular-nums; }

	/* KPI */
	.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 16px; }
	.kpi { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
	.kpi-label { font-size: 0.74rem; color: var(--ink-2); }
	.kpi-value { font-size: 1.35rem; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; }
	.kpi-unit { font-size: 0.78rem; font-weight: 600; color: var(--ink-3); margin-left: 2px; }
	.kpi.warn { border-color: #f0c98a; background: #fdf6e9; }
	.kpi.warn .kpi-value { color: #b07d1e; }

	/* カード */
	.card { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 18px 20px; box-shadow: var(--shadow-1); margin-bottom: 16px; }
	.card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
	.card-title { font-size: 1rem; font-weight: 700; margin: 0; }
	.card-sub { font-size: 0.74rem; color: var(--ink-3); font-variant-numeric: tabular-nums; }
	.card-foot-link { display: inline-block; margin-top: 14px; font-size: 0.8rem; color: var(--accent); text-decoration: none; font-weight: 600; }
	.card-foot-link:hover { text-decoration: underline; }

	/* 内訳 */
	.bd-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 16px; }
	.bd-row { display: flex; gap: 12px; align-items: flex-start; }
	.bd-chip { flex-shrink: 0; width: 12px; height: 12px; border-radius: 4px; margin-top: 3px; }
	.bd-main { flex: 1; min-width: 0; }
	.bd-top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
	.bd-name { font-size: 0.88rem; font-weight: 600; }
	.bd-amount { font-size: 0.95rem; font-weight: 800; font-variant-numeric: tabular-nums; }
	.bd-bar { height: 7px; background: var(--surface-sunk); border-radius: 4px; overflow: hidden; }
	.bd-fill { height: 100%; border-radius: 4px; transition: width 0.4s ease; }
	.bd-meta { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-top: 5px; }
	.bd-desc { font-size: 0.72rem; color: var(--ink-3); }
	.bd-share { font-size: 0.72rem; color: var(--ink-2); font-weight: 600; font-variant-numeric: tabular-nums; }

	/* 見込み利益リスト */
	.hint-box { margin-top: 14px; background: var(--surface-sunk); border: 1px dashed var(--line-strong); border-radius: 12px; padding: 16px; font-size: 0.84rem; color: var(--ink-2); line-height: 1.7; }
	.hint-box b { color: var(--ink); }
	.proj-list { list-style: none; margin: 16px 0 0; padding: 0; display: flex; flex-direction: column; }
	.proj-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 0; border-top: 1px solid var(--line); }
	.proj-main { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
	.proj-name { font-size: 0.9rem; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.proj-servings { font-size: 0.8rem; color: var(--ink-2); white-space: nowrap; }
	.proj-servings b { font-size: 1rem; color: var(--ink); font-variant-numeric: tabular-nums; }
	.proj-side { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
	.proj-profit { font-size: 0.98rem; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--ink); }
	.proj-profit.pos { color: #1a8a4f; }
	.proj-profit.neg { color: var(--accent-deep); }
	.proj-bottleneck { display: inline-flex; align-items: center; gap: 3px; font-size: 0.68rem; color: var(--accent-deep); }
	.proj-bottleneck.muted { color: var(--ink-3); }

	/* 追加フォーム */
	.add-form { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
	.inp { padding: 9px 11px; border: 1px solid var(--line-strong); border-radius: 9px; font-size: 0.88rem; font-family: inherit; background: var(--surface); color: var(--ink); }
	.inp:focus { outline: 2px solid var(--accent); border-color: transparent; }
	.inp-name { flex: 2; min-width: 150px; }
	.inp-num { flex: 1; min-width: 78px; text-align: right; }
	.btn-primary { padding: 9px 20px; background: var(--accent); color: #fff; border: none; border-radius: 9px; font-size: 0.88rem; font-weight: 700; cursor: pointer; font-family: inherit; white-space: nowrap; }
	.btn-primary:hover:not(:disabled) { background: var(--accent-deep); }
	.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

	/* テーブル */
	.table-wrap { overflow-x: auto; margin: 0 -4px; }
	.inv-table { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
	.inv-table th { padding: 8px 12px; text-align: left; font-size: 0.72rem; color: var(--ink-2); border-bottom: 1px solid var(--line); white-space: nowrap; }
	.inv-table td { padding: 9px 12px; border-bottom: 1px solid var(--surface-sunk); vertical-align: middle; }
	.inv-table tr:last-child td { border-bottom: none; }
	.c-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
	.c-name { font-weight: 600; }
	.c-act { white-space: nowrap; text-align: right; }
	.short-row { background: #fdf6e9; }
	.short-num { color: var(--accent-deep); font-weight: 700; }
	.dot { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; background: var(--accent-deep); color: #fff; font-size: 0.6rem; font-weight: 800; border-radius: 50%; margin-right: 5px; }

	.stepper { display: inline-flex; align-items: center; gap: 8px; }
	.step { width: 22px; height: 22px; border: 1px solid var(--line-strong); background: var(--surface); border-radius: 6px; font-size: 0.9rem; line-height: 1; cursor: pointer; color: var(--ink-2); }
	.step:hover { border-color: var(--accent); color: var(--accent); }
	.step-val { min-width: 20px; text-align: center; font-weight: 700; }

	.mini-btn { padding: 5px 11px; font-size: 0.76rem; background: var(--surface-sunk); border: 1px solid var(--line); border-radius: 7px; cursor: pointer; color: var(--ink); font-family: inherit; }
	.mini-btn:hover { border-color: var(--accent); color: var(--accent); }
	.mini-btn.dark { background: var(--accent); color: #fff; border-color: var(--accent); }
	.mini-btn.danger { color: var(--accent-deep); border-color: #e6b8a8; background: var(--surface); }
	.mini-btn.danger:hover { background: #fdf2ee; }
	.edit-row { background: #fffbf5; }
	.inp-inline { padding: 6px 8px; border: 1.5px solid var(--accent); border-radius: 6px; font-size: 0.84rem; width: 100%; box-sizing: border-box; font-family: inherit; }
	.inp-inline.num { text-align: right; max-width: 84px; }
	.empty-inline { font-size: 0.86rem; color: var(--ink-3); margin: 0; }

	@media (max-width: 480px) {
		.metric-value { font-size: 2.1rem; }
	}
</style>
