<svelte:head><title>屋台のできること | 管理者</title></svelte:head>

<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';

	let stalls = $state([]);
	let isLoading = $state(true);
	let migrated = $state(true);
	let msg = $state('');
	let errMsg = $state('');
	let savingId = $state(null);

	onMount(load);

	async function load() {
		isLoading = true;
		const res = await fetch('/api/admin/stalls');
		if (res.status === 403) { goto(`${base}/admin/login`); return; }
		if (res.ok) { const d = await res.json(); stalls = d.stalls ?? []; migrated = d.migrated !== false; }
		isLoading = false;
	}

	async function save(stall) {
		savingId = stall.id; errMsg = '';
		const res = await fetch('/api/admin/stalls', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				id: stall.id,
				can_cook_onsite: stall.can_cook_onsite,
				can_retail: stall.can_retail,
				can_workshop: stall.can_workshop
			})
		});
		savingId = null;
		if (res.ok) { msg = '保存しました'; setTimeout(() => (msg = ''), 2500); }
		else { const d = await res.json().catch(() => ({})); errMsg = d.message ?? '保存に失敗しました'; }
	}
</script>

<div class="page">
	<header class="top-bar">
		<a href="{base}/admin" class="back-link">← 管理ダッシュボード</a>
		<h1 class="page-title">屋台のできること</h1>
	</header>

	{#if msg}<div class="toast success">{msg}</div>{/if}
	{#if errMsg}<div class="toast error">{errMsg}</div>{/if}

	<div class="content">
		{#if !migrated}
			<div class="notice">マイグレーション v23 が未適用です。能力フラグの列が無いため保存できません。先に <code>supabase_migration_v23.sql</code> を実行してください。</div>
		{/if}

		{#if isLoading}
			<div class="empty">読み込み中…</div>
		{:else if stalls.length === 0}
			<div class="empty">屋台が登録されていません。</div>
		{:else}
			<p class="count">{stalls.length} 台。屋台ごとに「できること」を設定します（利用者が屋台人登録後に表示されます）。</p>
			{#each stalls as s (s.id)}
				<div class="stall-card">
					<div class="stall-head">
						<span class="stall-name">{s.stall_name ?? '屋台'}</span>
						<span class="stall-owner">{s.operators?.business_name ?? '提供者未設定'}</span>
					</div>
					<div class="caps">
						<label class="cap-toggle"><input type="checkbox" bind:checked={s.can_cook_onsite} disabled={!migrated} /> 現場調理可能</label>
						<label class="cap-toggle"><input type="checkbox" bind:checked={s.can_retail} disabled={!migrated} /> 小売可能</label>
						<label class="cap-toggle"><input type="checkbox" bind:checked={s.can_workshop} disabled={!migrated} /> ワークショップ可能</label>
					</div>
					<button class="save-btn" onclick={() => save(s)} disabled={savingId === s.id || !migrated}>
						{savingId === s.id ? '保存中…' : '保存'}
					</button>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.page { min-height: 100svh; background: var(--surface-sunk); font-family: sans-serif; padding-bottom: 60px; }
	.top-bar { position: sticky; top: 0; z-index: 10; background: rgba(250,248,245,0.97); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); display: flex; align-items: center; gap: 16px; padding: 12px 20px; }
	.back-link { font-size: 0.82rem; color: var(--ink-2); text-decoration: none; }
	.back-link:hover { color: var(--ink); }
	.page-title { font-size: 1rem; font-weight: 700; color: var(--ink); margin: 0; }
	.toast { margin: 12px 20px; padding: 10px 16px; border-radius: 10px; font-size: 0.88rem; }
	.toast.success { background: #ecfdf5; color: #14532d; border: 1px solid #bbf7d0; }
	.toast.error { background: #fef2f2; color: var(--accent-deep); border: 1px solid #fecaca; }
	.content { padding: 16px 20px; max-width: 640px; margin: 0 auto; }
	.count { font-size: 0.82rem; color: var(--ink-2); margin: 0 0 12px; }
	.empty { text-align: center; padding: 60px 20px; color: var(--ink-3); font-size: 0.9rem; }
	.notice { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px; padding: 12px 14px; font-size: 0.84rem; color: #78350f; margin-bottom: 16px; }
	.notice code { font-family: monospace; }

	.stall-card { background: #fff; border-radius: 14px; box-shadow: 0 2px 10px rgba(0,0,0,0.06); padding: 16px; margin-bottom: 12px; border: 1px solid var(--surface-sunk); }
	.stall-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
	.stall-name { font-size: 0.95rem; font-weight: 700; color: var(--ink); }
	.stall-owner { font-size: 0.78rem; color: var(--ink-3); }
	.caps { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 14px; }
	.cap-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 0.86rem; color: var(--ink); cursor: pointer; }
	.cap-toggle input { width: 17px; height: 17px; accent-color: var(--accent); cursor: pointer; }
	.save-btn { padding: 8px 18px; border-radius: 8px; border: none; background: var(--accent); color: #fff; font-size: 0.84rem; font-weight: 700; cursor: pointer; font-family: inherit; }
	.save-btn:hover:not(:disabled) { background: var(--accent-deep); }
	.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
