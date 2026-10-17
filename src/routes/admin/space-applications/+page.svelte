<svelte:head><title>場所提供の申請 | 管理者</title></svelte:head>

<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';

	const STATUS = [
		['new', '新着'],
		['contacted', '連絡済み'],
		['visited', '現地ヒアリング済み'],
		['contracted', '契約済み'],
		['declined', '見送り']
	];
	const statusLabel = Object.fromEntries(STATUS);

	let apps = $state([]);
	let isLoading = $state(true);
	let filter = $state('open');
	let msg = $state('');
	let errMsg = $state('');
	let savingId = $state(null);

	onMount(load);
	async function load() {
		isLoading = true;
		const res = await fetch('/api/admin/space-applications');
		if (res.status === 403) { goto(`${base}/admin/login`); return; }
		if (res.ok) apps = ((await res.json()).applications ?? []).map((a) => ({ ...a, _note: a.admin_note ?? '' }));
		else errMsg = 'v31 のマイグレーションが適用されているか確認してください。';
		isLoading = false;
	}

	async function save(a) {
		savingId = a.id; errMsg = '';
		const res = await fetch('/api/admin/space-applications', {
			method: 'POST', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: a.id, status: a.status, adminNote: a._note })
		});
		savingId = null;
		if (res.ok) { msg = '保存しました'; setTimeout(() => (msg = ''), 2500); }
		else errMsg = (await res.json().catch(() => ({}))).message ?? '保存に失敗しました';
	}

	let shown = $derived(
		filter === 'all' ? apps : apps.filter((a) => (filter === 'open' ? !['contracted', 'declined'].includes(a.status) : a.status === filter))
	);
	const fmt = (iso) => new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
</script>

<div class="page">
	<header class="top-bar">
		<a href="{base}/admin" class="back-link">← 管理ダッシュボード</a>
		<h1 class="page-title">場所提供の申請</h1>
	</header>

	{#if msg}<div class="toast success" role="status">{msg}</div>{/if}
	{#if errMsg}<div class="toast error" role="alert">{errMsg}</div>{/if}

	<div class="content">
		<p class="lead">公開フォーム（<a href="{base}/space-apply" target="_blank" rel="noopener">/space-apply</a>）から届いた申請です。現地でヒアリングと契約をしたら、「屋台と場所の設定」で場所の料金・紐づけ・貸し出し不可の時間帯を登録してください。</p>
		<div class="filters" role="tablist">
			{#each [['open', '対応中'], ['all', 'すべて'], ...STATUS] as [v, l]}
				<button role="tab" aria-selected={filter === v} class="chip" class:on={filter === v} onclick={() => (filter = v)}>{l}</button>
			{/each}
		</div>

		{#if isLoading}
			<div class="empty">読み込み中…</div>
		{:else if shown.length === 0}
			<div class="empty">該当する申請はありません。</div>
		{:else}
			{#each shown as a (a.id)}
				<article class="card">
					<div class="card-head">
						<span class="name">{a.applicant_name}{a.organization ? `（${a.organization}）` : ''}</span>
						<span class="badge {a.status}">{statusLabel[a.status]}</span>
					</div>
					<dl class="info">
						<dt>受付</dt><dd>{fmt(a.created_at)}</dd>
						<dt>所在地</dt><dd>{a.address}</dd>
						<dt>メール</dt><dd class="sel">{a.email}</dd>
						{#if a.phone}<dt>電話</dt><dd class="sel">{a.phone}</dd>{/if}
						{#if a.description}<dt>場所について</dt><dd class="pre">{a.description}</dd>{/if}
						{#if a.unavailable_times}<dt>貸せない時間帯</dt><dd class="pre">{a.unavailable_times}</dd>{/if}
					</dl>
					<div class="row">
						<label class="field">
							<span class="label">対応状況</span>
							<select id="st-{a.id}" bind:value={a.status}>{#each STATUS as [v, l]}<option value={v}>{l}</option>{/each}</select>
						</label>
					</div>
					<label class="field">
						<span class="label">運営メモ（ヒアリング内容・契約条件など）</span>
						<textarea id="note-{a.id}" rows="3" bind:value={a._note}></textarea>
					</label>
					<div class="actions"><button class="btn" disabled={savingId === a.id} onclick={() => save(a)}>保存</button></div>
				</article>
			{/each}
		{/if}
	</div>
</div>

<style>
	.page { min-height: 100svh; background: var(--surface-sunk); font-family: var(--font-gothic); padding-bottom: 60px; }
	.top-bar { position: sticky; top: 0; z-index: 10; background: var(--surface); border-bottom: 1px solid var(--line); display: flex; align-items: center; gap: 16px; padding: 12px 20px; }
	.back-link { font-size: 0.82rem; color: var(--ink-2); text-decoration: none; }
	.page-title { font-size: 1rem; font-weight: 500; color: var(--ink); margin: 0; }
	.toast { margin: 12px 20px; padding: 10px 16px; border-radius: 10px; font-size: 0.88rem; }
	.toast.success { background: #ecfdf5; color: #14532d; border: 1px solid #bbf7d0; }
	.toast.error { background: #fef2f2; color: var(--accent-deep); border: 1px solid #fecaca; }
	.content { padding: 16px 20px; max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
	.lead { margin: 0; font-size: 0.82rem; color: var(--ink-2); line-height: 1.6; }
	.filters { display: flex; flex-wrap: wrap; gap: 6px; }
	.chip { padding: 5px 12px; border-radius: 999px; border: 1px solid var(--line-strong); background: var(--surface); color: var(--ink-2); font-size: 0.8rem; cursor: pointer; font-family: var(--font-gothic); }
	.chip.on { background: var(--ink); border-color: var(--ink); color: var(--surface); }
	.empty { text-align: center; padding: 40px 0; color: var(--ink-3); font-size: 0.86rem; }
	.card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
	.card-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
	.name { font-size: 0.95rem; color: var(--ink); }
	.badge { font-size: 0.72rem; padding: 2px 8px; border-radius: 999px; background: var(--surface-sunk); color: var(--ink-2); white-space: nowrap; }
	.badge.new { background: var(--accent-tint); color: var(--accent-deep); }
	.badge.contracted { background: #ecfdf5; color: #14532d; }
	.info { display: grid; grid-template-columns: 7em 1fr; gap: 4px 10px; margin: 0; font-size: 0.84rem; }
	.info dt { color: var(--ink-3); }
	.info dd { margin: 0; color: var(--ink); min-width: 0; overflow-wrap: anywhere; }
	.pre { white-space: pre-wrap; }
	.sel { user-select: all; }
	.row { display: flex; gap: 10px; }
	.field { display: flex; flex-direction: column; gap: 4px; }
	.label { font-size: 0.74rem; color: var(--ink-2); }
	.field select, .field textarea { padding: 8px 10px; border: 1px solid var(--line-strong); border-radius: 8px; font-size: 0.9rem; background: var(--surface); font-family: var(--font-gothic); color: var(--ink); }
	.actions { display: flex; justify-content: flex-end; }
	.btn { padding: 8px 18px; border-radius: 8px; border: none; background: var(--accent); color: #fff; font-size: 0.86rem; cursor: pointer; font-family: var(--font-gothic); }
	.btn:disabled { opacity: 0.5; }
</style>
