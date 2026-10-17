<svelte:head><title>月末の振込額 | 管理者</title></svelte:head>

<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';

	const now = new Date(Date.now() + 9 * 3600000);
	let month = $state(now.toISOString().slice(0, 7));
	let data = $state(null);
	let isLoading = $state(true);
	let errMsg = $state('');

	async function load() {
		isLoading = true; errMsg = '';
		const res = await fetch(`/api/admin/payouts?month=${month}`);
		if (res.status === 403) { goto(`${base}/admin/login`); return; }
		if (res.ok) data = await res.json();
		else errMsg = (await res.json().catch(() => ({}))).message ?? '読み込めませんでした';
		isLoading = false;
	}
	onMount(load);

	const yen = (n) => `¥${Number(n ?? 0).toLocaleString()}`;
	const roleLabel = { stall: '屋台代', space: '場所代' };
	const statusLabel = { partial: '一部のみ請求', failed: '請求できず' };
	const fmt = (iso) => (iso ? new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
</script>

<div class="page">
	<header class="top-bar">
		<a href="{base}/admin" class="back-link">← 管理ダッシュボード</a>
		<h1 class="page-title">月末の振込額（屋台・場所の提供者）</h1>
	</header>

	<div class="content">
		<div class="controls">
			<label class="field"><span class="label">対象の月</span><input id="payout-month" type="month" bind:value={month} onchange={load} /></label>
			<p class="lead">返却時に記録した利用料金を、提供者ごと・屋台代と場所代に分けて集計しています（日本時間の月で集計）。</p>
		</div>

		{#if errMsg}<div class="toast error" role="alert">{errMsg}</div>{/if}

		{#if isLoading}
			<div class="empty">読み込み中…</div>
		{:else if data}
			<div class="totals">
				<div class="total"><span class="t-label">屋台代の合計</span><span class="t-value">{yen(data.totals.stall)}</span></div>
				<div class="total"><span class="t-label">場所代の合計</span><span class="t-value">{yen(data.totals.space)}</span></div>
			</div>

			{#if data.payees.length === 0}
				<div class="empty">この月の記録はありません。</div>
			{:else}
				<div class="table-wrap">
					<table>
						<thead><tr><th>提供者</th><th>区分</th><th class="num">件数</th><th class="num">金額</th><th class="num">未回収</th></tr></thead>
						<tbody>
							{#each data.payees as p}
								<tr>
									<td>{p.name}</td>
									<td><span class="role {p.role}">{roleLabel[p.role]}</span></td>
									<td class="num">{p.count}</td>
									<td class="num">{yen(p.amount)}</td>
									<td class="num">{p.unpaidCount ? `${p.unpaidCount}件` : '—'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			<h2 class="block-title">カードで全額を請求できなかった利用</h2>
			{#if data.shortfalls.length === 0}
				<p class="none">ありません。</p>
			{:else}
				<p class="lead">利用者への連絡と回収が必要です。上の金額には、これらの利用分も含まれています。</p>
				<ul class="list">
					{#each data.shortfalls as s}
						<li class="list-item">
							<span class="li-main">{s.place || '屋台'}（返却 {fmt(s.returnedAt)}）</span>
							<span class="li-sub">{statusLabel[s.status]}：請求済み {yen(s.charged)}{s.owed != null ? ` ／ 利用料金 ${yen(s.owed)}（未回収 ${yen(s.owed - s.charged)}）` : ''}</span>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</div>
</div>

<style>
	.page { min-height: 100svh; background: var(--surface-sunk); font-family: var(--font-gothic); padding-bottom: 60px; }
	.top-bar { position: sticky; top: 0; z-index: 10; background: var(--surface); border-bottom: 1px solid var(--line); display: flex; align-items: center; gap: 16px; padding: 12px 20px; }
	.back-link { font-size: 0.82rem; color: var(--ink-2); text-decoration: none; }
	.page-title { font-size: 1rem; font-weight: 500; color: var(--ink); margin: 0; }
	.content { padding: 16px 20px; max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
	.controls { display: flex; flex-direction: column; gap: 6px; }
	.field { display: flex; flex-direction: column; gap: 4px; max-width: 200px; }
	.label { font-size: 0.74rem; color: var(--ink-2); }
	.field input { padding: 8px 10px; border: 1px solid var(--line-strong); border-radius: 8px; font-size: 0.92rem; background: var(--surface); font-family: var(--font-gothic); color: var(--ink); }
	.lead { margin: 0; font-size: 0.82rem; color: var(--ink-2); line-height: 1.6; }
	.toast.error { padding: 10px 16px; border-radius: 10px; background: #fef2f2; color: var(--accent-deep); border: 1px solid #fecaca; font-size: 0.88rem; }
	.empty, .none { color: var(--ink-3); font-size: 0.86rem; }
	.empty { text-align: center; padding: 40px 0; }
	.totals { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
	.total { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; }
	.t-label { font-size: 0.76rem; color: var(--ink-2); }
	.t-value { font-size: 1.3rem; color: var(--ink); font-variant-numeric: tabular-nums; }
	.table-wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; }
	table { width: 100%; border-collapse: collapse; font-size: 0.86rem; white-space: nowrap; }
	th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--line); white-space: nowrap; }
	th { font-weight: 500; font-size: 0.76rem; color: var(--ink-2); background: var(--surface-sunk); }
	tr:last-child td { border-bottom: none; }
	.num { text-align: right; font-variant-numeric: tabular-nums; }
	.role { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 0.74rem; }
	.role.stall { background: var(--accent-tint); color: var(--accent-deep); }
	.role.space { background: #e7eef8; color: #2f4f7a; }
	.block-title { font-size: 0.95rem; font-weight: 500; margin: 10px 0 0; }
	.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
	.list-item { display: flex; flex-direction: column; gap: 2px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; }
	.li-main { font-size: 0.88rem; color: var(--ink); }
	.li-sub { font-size: 0.78rem; color: #b91c1c; }
</style>
