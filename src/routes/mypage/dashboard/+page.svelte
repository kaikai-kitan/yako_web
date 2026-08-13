<svelte:head>
	<title>収益ダッシュボード | YATAKARI</title>
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

	const now = new Date();
	let selectedMonth = $state(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

	// 収益データ
	let revenueByType = $state({ yatai_usage: 0, yatai_rental: 0, land_rental: 0 });
	let shopRevenue = $state(0);
	let orderCount = $state(0);
	let chartData = $state([]); // [{month, label, total}]

	let inventoryAlert = $state(0);
	let myStalls = $state([]);

	// ロール判定
	let hasShopRole = $derived(!!operatorData || !!profile?.is_shop_operator);
	let hasLandRole = $derived(!!ownerData || !!profile?.is_land_owner);
	let hasYataiOwnerRole = $derived(!!profile?.is_yatai_owner || profile?.user_type === '屋台提供者');
	let hasYataiUserRole = $derived(!!profile?.is_yatai_user || ['利用者', '購入者'].includes(profile?.user_type));
	let hasAnyRole = $derived(hasYataiUserRole || hasYataiOwnerRole || hasLandRole || hasShopRole);

	let totalRevenue = $derived(
		(revenueByType.yatai_usage ?? 0) +
		(revenueByType.yatai_rental ?? 0) +
		(revenueByType.land_rental ?? 0) +
		shopRevenue
	);

	// ── 収益内訳（ロール固定色。dataviz既定カテゴリカルの上位4色を各ロールに固定割当） ──
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

	// 前月比（推移データから）
	let deltaPct = $derived.by(() => {
		const idx = chartData.findIndex((d) => d.month === selectedMonth);
		if (idx <= 0) return null;
		const cur = chartData[idx].total, prev = chartData[idx - 1].total;
		if (prev <= 0) return null;
		return Math.round(((cur - prev) / prev) * 100);
	});

	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) { goto(`${base}/`); return; }
		userId = user.id;
		await loadProfile(user.id);
		await Promise.all([
			loadRevenue(user.id),
			loadChart(user.id),
			loadInventoryAlert(user.id),
			loadMyStalls(user.id)
		]);
	});

	async function loadMyStalls(uid) {
		try { myStalls = await getMyStalls(uid); } catch { myStalls = []; }
	}

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
			supabase.from('revenue_logs').select('revenue_type, amount')
				.eq('user_id', uid).gte('occurred_at', start).lt('occurred_at', end),
			operatorData
				? supabase.from('shop_orders').select('total_amount')
						.eq('operator_id', uid).gte('created_at', start).lt('created_at', end)
				: Promise.resolve({ data: [] })
		]);

		const byType = { yatai_usage: 0, yatai_rental: 0, land_rental: 0 };
		for (const log of logsRes.data ?? []) {
			if (log.revenue_type in byType) byType[log.revenue_type] += log.amount;
		}
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

	async function loadInventoryAlert(uid) {
		const { data } = await supabase.from('inventory').select('required_qty, current_qty').eq('user_id', uid);
		inventoryAlert = (data ?? []).filter((i) => i.required_qty > i.current_qty).length;
	}

	$effect(() => {
		selectedMonth;
		if (userId && operatorData !== undefined) loadRevenue(userId);
	});

	function fmt(n) { return `¥${(n ?? 0).toLocaleString()}`; }
	function fmtShort(n) {
		if (n >= 1_000_000) return `¥${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
		if (n >= 1000) return `¥${Math.round(n / 1000)}K`;
		return `¥${n}`;
	}

	// ── 折れ線/エリアチャートの座標計算 ──
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

	// ホバー
	let hoverIdx = $state(null);
	let chartEl = $state();
	function onChartMove(e) {
		if (!chartEl || pts.length === 0) return;
		const rect = chartEl.getBoundingClientRect();
		const xVb = (e.clientX - rect.left) * (CW / rect.width);
		const step = chartData.length > 1 ? plotW / (chartData.length - 1) : plotW;
		let idx = Math.round((xVb - padL) / step);
		hoverIdx = Math.max(0, Math.min(chartData.length - 1, idx));
	}
	function onChartLeave() { hoverIdx = null; }
	let hover = $derived(hoverIdx != null ? pts[hoverIdx] : null);
</script>

<div class="page">
	<header class="page-header">
		<a href="{base}/mypage" class="back-link">‹ マイページ</a>
		<div class="header-row">
			<h1 class="page-title">収益ダッシュボード</h1>
			<div class="controls">
				<input type="month" bind:value={selectedMonth} class="month-input" aria-label="表示月" />
				<a href="{base}/mypage/inventory" class="chip-link">
					<Icon name="package" size={15} /> 在庫
					{#if inventoryAlert > 0}<span class="alert-badge">{inventoryAlert}</span>{/if}
				</a>
			</div>
		</div>
	</header>

	{#if isLoading}
		<div class="loading">読み込み中…</div>
	{:else if !hasAnyRole}
		<div class="no-role">
			<p>収益を表示するためのロールが設定されていません。</p>
			<a href="{base}/mypage" class="no-role-link">マイページでロールを追加する ›</a>
		</div>
	{:else}
		<!-- 分析サマリー（総利益＋前月比＋推移） -->
		<section class="analytics">
			<div class="analytics-head">
				<div>
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
				</div>
			</div>

			<figure class="chart" role="group" aria-label="直近6ヶ月の総利益の推移">
				<figcaption class="chart-cap">総利益の推移（直近6ヶ月）</figcaption>
				<div class="chart-holder">
					<svg bind:this={chartEl} viewBox="0 0 {CW} {CH}" class="chart-svg" preserveAspectRatio="none"
						onpointermove={onChartMove} onpointerleave={onChartLeave} role="presentation">
						<defs>
							<linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stop-color="var(--accent)" stop-opacity="0.22" />
								<stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
							</linearGradient>
						</defs>
						<!-- grid -->
						{#each gridLines as g}
							<line x1={padL} x2={CW - padR} y1={g.y} y2={g.y} class="grid" />
							<text x={padL - 8} y={g.y + 3} text-anchor="end" class="axis-y">{fmtShort(g.v)}</text>
						{/each}
						<!-- area + line -->
						<path d={areaPath} fill="url(#area-grad)" />
						<path d={linePath} class="line" />
						<!-- crosshair -->
						{#if hover}
							<line x1={hover.x} x2={hover.x} y1={padT} y2={padT + plotH} class="crosshair" />
						{/if}
						<!-- points -->
						{#each pts as p}
							<circle cx={p.x} cy={p.y} r={hoverIdx === p.i ? 5 : (p.i === pts.length - 1 ? 4 : 3)}
								class="dot" class:emph={p.i === pts.length - 1 || hoverIdx === p.i} />
						{/each}
						<!-- x labels -->
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

		<!-- 補助指標（該当ロールのみ） -->
		{#if hasShopRole}
			<section class="kpis">
				<div class="kpi">
					<span class="kpi-label">ショップ売上</span>
					<span class="kpi-value">{fmt(shopRevenue)}</span>
				</div>
				<div class="kpi">
					<span class="kpi-label">注文数</span>
					<span class="kpi-value">{orderCount}<span class="kpi-unit">件</span></span>
				</div>
				<div class="kpi">
					<span class="kpi-label">平均注文額</span>
					<span class="kpi-value">{fmt(orderCount > 0 ? Math.round(shopRevenue / orderCount) : 0)}</span>
				</div>
				<div class="kpi" class:warn={inventoryAlert > 0}>
					<span class="kpi-label">在庫アラート</span>
					<span class="kpi-value">{inventoryAlert}<span class="kpi-unit">件</span></span>
				</div>
			</section>
		{/if}

		<!-- 収益の内訳 -->
		<section class="card">
			<div class="card-head">
				<h2 class="card-title">収益の内訳</h2>
				<span class="card-sub">{selectedMonth}</span>
			</div>
			<ul class="bd-list">
				{#each breakdown as b}
					{@const share = totalRevenue > 0 ? (b.amount / totalRevenue) * 100 : 0}
					<li class="bd-row">
						<span class="bd-chip" style="background:{b.color}"></span>
						<div class="bd-main">
							<div class="bd-top">
								<span class="bd-name">{b.label}</span>
								<span class="bd-amount">{fmt(b.amount)}</span>
							</div>
							<div class="bd-bar"><div class="bd-fill" style="width:{share}%; background:{b.color}"></div></div>
							<div class="bd-meta"><span class="bd-desc">{b.desc}</span><span class="bd-share">{share.toFixed(0)}%</span></div>
						</div>
					</li>
				{/each}
			</ul>
			{#if hasShopRole}
				<a href="{base}/mypage/operator" class="card-foot-link">ショップの詳細・精算管理 ›</a>
			{/if}
		</section>

		<!-- 夜行人ネットワーク接続タグ -->
		{#if myStalls.length > 0}
			<section class="card">
				<div class="card-head">
					<h2 class="card-title">夜行人ネットワーク 接続タグ</h2>
				</div>
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
</div>

<style>
	.page { max-width: 760px; margin: 0 auto; padding: 22px 16px 80px; color: var(--ink); }

	/* ── ヘッダー ── */
	.page-header { margin-bottom: 20px; }
	.back-link { font-size: 0.82rem; color: var(--ink-2); text-decoration: none; }
	.back-link:hover { color: var(--accent); }
	.header-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-top: 6px; }
	.page-title { font-size: 1.35rem; font-weight: 700; margin: 0; letter-spacing: 0.01em; }
	.controls { display: flex; align-items: center; gap: 10px; }
	.month-input { padding: 7px 11px; border: 1px solid var(--line-strong); border-radius: 9px; font-size: 0.85rem; font-family: inherit; background: var(--surface); color: var(--ink); }
	.month-input:focus { outline: 2px solid var(--accent); border-color: transparent; }
	.chip-link { display: inline-flex; align-items: center; gap: 5px; padding: 7px 12px; background: var(--surface); border: 1px solid var(--line-strong); border-radius: 9px; font-size: 0.82rem; color: var(--ink); text-decoration: none; }
	.chip-link:hover { border-color: var(--accent); color: var(--accent); }
	.alert-badge { background: var(--accent-deep); color: #fff; font-size: 0.68rem; font-weight: 700; padding: 1px 6px; border-radius: 999px; }

	.loading { text-align: center; padding: 60px; color: var(--ink-2); }
	.no-role { text-align: center; padding: 48px 20px; color: var(--ink-2); font-size: 0.9rem; }
	.no-role-link { display: inline-block; margin-top: 12px; color: var(--accent); text-decoration: none; font-weight: 600; }

	/* ── 分析サマリー ── */
	.analytics { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 22px 22px 8px; box-shadow: var(--shadow-1); margin-bottom: 16px; }
	.metric-label { font-size: 0.8rem; color: var(--ink-2); margin: 0 0 4px; letter-spacing: 0.02em; }
	.metric-value { font-size: 2.5rem; font-weight: 800; letter-spacing: -0.02em; margin: 0; color: var(--ink); font-variant-numeric: tabular-nums; line-height: 1.05; }
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

	/* ── 補助指標 ── */
	.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
	.kpi { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
	.kpi-label { font-size: 0.74rem; color: var(--ink-2); }
	.kpi-value { font-size: 1.35rem; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; }
	.kpi-unit { font-size: 0.78rem; font-weight: 600; color: var(--ink-3); margin-left: 2px; }
	.kpi.warn { border-color: #f0c98a; background: #fdf6e9; }
	.kpi.warn .kpi-value { color: var(--warn, #b07d1e); }

	/* ── カード共通 ── */
	.card { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 18px 20px; box-shadow: var(--shadow-1); margin-bottom: 16px; }
	.card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
	.card-title { font-size: 1rem; font-weight: 700; margin: 0; }
	.card-sub { font-size: 0.74rem; color: var(--ink-3); font-variant-numeric: tabular-nums; }
	.card-foot-link { display: inline-block; margin-top: 12px; font-size: 0.8rem; color: var(--accent); text-decoration: none; font-weight: 600; }
	.card-foot-link:hover { text-decoration: underline; }

	/* ── 内訳リスト ── */
	.bd-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 16px; }
	.bd-row { display: flex; gap: 12px; align-items: flex-start; }
	.bd-chip { flex-shrink: 0; width: 12px; height: 12px; border-radius: 4px; margin-top: 3px; }
	.bd-main { flex: 1; min-width: 0; }
	.bd-top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
	.bd-name { font-size: 0.88rem; font-weight: 600; color: var(--ink); }
	.bd-amount { font-size: 0.95rem; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; }
	.bd-bar { height: 7px; background: var(--surface-sunk); border-radius: 4px; overflow: hidden; }
	.bd-fill { height: 100%; border-radius: 4px; transition: width 0.4s ease; }
	.bd-meta { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-top: 5px; }
	.bd-desc { font-size: 0.72rem; color: var(--ink-3); }
	.bd-share { font-size: 0.72rem; color: var(--ink-2); font-weight: 600; font-variant-numeric: tabular-nums; }

	/* ── 接続タグ ── */
	.tag-lead { font-size: 0.83rem; color: var(--ink-2); line-height: 1.6; margin: 0 0 14px; }
	.tag-lead a { color: var(--accent); text-decoration: none; }
	.tag-lead a:hover { text-decoration: underline; }
	.tag-list { display: flex; flex-direction: column; gap: 10px; }
	.tag-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 16px; background: var(--surface); border: 1px solid var(--line-strong); border-radius: 12px; text-decoration: none; transition: border-color 0.15s; }
	.tag-row:hover { border-color: var(--accent); }
	.tag-name { display: inline-flex; align-items: center; gap: 8px; font-size: 0.9rem; font-weight: 700; color: var(--ink); }
	.tag-cta { font-size: 0.8rem; font-weight: 700; color: var(--accent); white-space: nowrap; }

	@media (max-width: 480px) {
		.metric-value { font-size: 2.1rem; }
	}
</style>
