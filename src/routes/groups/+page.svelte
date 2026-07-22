<svelte:head><title>イベントグループ | 微小夜行電灯</title></svelte:head>

<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';
	import Icon from '$lib/components/Icon.svelte';

	let accessToken = $state('');
	let isLoading = $state(true);
	let canCreate = $state(false);
	let groups = $state([]);

	let showForm = $state(false);
	let name = $state('');
	let description = $state('');
	let startsAt = $state('');
	let endsAt = $state('');
	let busy = $state(false);
	let errMsg = $state('');

	// 参加（コード入力）
	let joinCode = $state('');
	let joinBusy = $state(false);
	let joinErr = $state('');

	onMount(async () => {
		const { data: { session } } = await supabase.auth.getSession();
		if (!session) { goto(`${base}/auth`); return; }
		accessToken = session.access_token;
		await load();
		isLoading = false;
	});

	async function load() {
		const res = await fetch('/api/groups/mine', { headers: { Authorization: `Bearer ${accessToken}` } });
		if (res.ok) {
			const d = await res.json();
			groups = d.groups ?? [];
			canCreate = !!d.canCreate;
		}
	}

	async function createGroup() {
		errMsg = '';
		if (!name.trim()) { errMsg = 'グループ名を入力してください'; return; }
		busy = true;
		try {
			const res = await fetch('/api/groups/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
				body: JSON.stringify({ name, description, startsAt: startsAt || null, endsAt: endsAt || null })
			});
			const d = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(d.message ?? '作成に失敗しました');
			goto(`${base}/groups/${d.group.id}`);
		} catch (e) { errMsg = e.message; busy = false; }
	}

	async function joinByCode() {
		joinErr = '';
		if (!joinCode.trim()) { joinErr = 'コードを入力してください'; return; }
		joinBusy = true;
		try {
			const res = await fetch('/api/groups/join', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
				body: JSON.stringify({ code: joinCode })
			});
			const d = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(d.message ?? '参加に失敗しました');
			goto(`${base}/groups/${d.groupId}`);
		} catch (e) { joinErr = e.message; joinBusy = false; }
	}

	function fmtRange(s, e) {
		const f = (iso) => iso ? new Date(iso).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }) : null;
		const a = f(s), b = f(e);
		if (a && b) return `${a} 〜 ${b}`;
		if (b) return `〜 ${b}`;
		if (a) return `${a} 〜`;
		return '期間未設定';
	}
	const isEnded = (e) => e && new Date(e).getTime() < Date.now();
</script>

<div class="page">
	<div class="nav">
		<a class="back" href="{base}/directory">← 夜行人図鑑</a>
	</div>

	<header class="head">
		<span class="kicker">EVENT GROUPS</span>
		<h1 class="title">イベントグループ</h1>
		<p class="lead">イベントごとの夜行人ネットワークをつくって、その場の縁を可視化しましょう。</p>
	</header>

	{#if isLoading}
		<p class="loading">読み込み中…</p>
	{:else}
		<!-- 参加（コード） -->
		<section class="card">
			<h2 class="card-title"><Icon name="qr-code" size={18} /> グループに参加</h2>
			<p class="card-hint">主催者から受け取った招待コードを入力するか、QRを読み取って参加できます。</p>
			{#if joinErr}<p class="err">{joinErr}</p>{/if}
			<div class="join-row">
				<input class="input code-input" bind:value={joinCode} placeholder="招待コード（例: AB12CD34）" maxlength="8" />
				<button class="btn" onclick={joinByCode} disabled={joinBusy}>参加</button>
			</div>
		</section>

		<!-- 作成 -->
		{#if canCreate}
			<section class="card">
				<div class="card-head">
					<h2 class="card-title"><Icon name="badge-check" size={18} /> グループを作成</h2>
					{#if !showForm}
						<button class="btn ghost sm" onclick={() => (showForm = true)}>新規作成</button>
					{/if}
				</div>
				{#if showForm}
					{#if errMsg}<p class="err">{errMsg}</p>{/if}
					<label class="field"><span class="field-label">グループ名</span>
						<input class="input" bind:value={name} maxlength="40" placeholder="例: 鴨川ナイトマーケット 2026夏" />
					</label>
					<label class="field"><span class="field-label">説明（任意）</span>
						<input class="input" bind:value={description} maxlength="200" placeholder="イベントの概要など" />
					</label>
					<div class="field-row">
						<label class="field"><span class="field-label">開始（任意）</span>
							<input class="input" type="datetime-local" bind:value={startsAt} />
						</label>
						<label class="field"><span class="field-label">終了（任意）</span>
							<input class="input" type="datetime-local" bind:value={endsAt} />
						</label>
					</div>
					<p class="fine">終了日時を過ぎると参加受付は締め切られます（図の閲覧は可能）。</p>
					<div class="form-actions">
						<button class="btn" onclick={createGroup} disabled={busy}>作成する</button>
						<button class="btn ghost" onclick={() => (showForm = false)} disabled={busy}>キャンセル</button>
					</div>
				{/if}
			</section>
		{:else}
			<section class="card muted-card">
				<p class="upsell"><Icon name="badge-check" size={16} /> グループの作成は<strong>有料プランのご契約者</strong>のみご利用いただけます。</p>
				<a class="btn ghost sm" href="{base}/mypage">プランを確認する</a>
			</section>
		{/if}

		<!-- 参加中のグループ -->
		<section class="card">
			<h2 class="card-title">参加中のグループ</h2>
			{#if groups.length === 0}
				<p class="empty">まだ参加しているグループはありません。</p>
			{:else}
				<ul class="group-list">
					{#each groups as g}
						<li>
							<a class="group-item" href="{base}/groups/{g.id}">
								<div class="gi-main">
									<span class="gi-name">{g.name}</span>
									{#if g.is_owner}<span class="gi-badge owner">主催</span>{/if}
									{#if isEnded(g.ends_at)}<span class="gi-badge ended">終了</span>{/if}
									{#if g.description}<span class="gi-desc">{g.description}</span>{/if}
									<span class="gi-meta">{fmtRange(g.starts_at, g.ends_at)}・{g.member_count}人</span>
								</div>
								<span class="gi-arrow">›</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</div>

<style>
	.page { max-width: 640px; margin: 0 auto; padding: 20px 20px 80px; box-sizing: border-box; }
	.nav { margin-bottom: 18px; }
	.back { font-size: 0.85rem; color: var(--ink-2); text-decoration: none; }
	.back:hover { color: var(--ink); }
	.loading, .empty { color: var(--ink-3); font-size: 0.9rem; text-align: center; padding: 20px 0; }

	.head { margin-bottom: 22px; }
	.kicker { display: block; font-size: 0.7rem; letter-spacing: 0.28em; color: var(--accent); margin-bottom: 6px; }
	.title { font-family: "Zen Antique", serif; font-size: 1.5rem; letter-spacing: 0.06em; color: var(--ink); margin: 0 0 8px; }
	.lead { font-size: 0.86rem; color: var(--ink-2); line-height: 1.7; margin: 0; }

	.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg, 16px); padding: 18px; margin-bottom: 16px; box-shadow: var(--shadow-1); }
	.card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
	.card-title { display: inline-flex; align-items: center; gap: 7px; font-size: 1rem; font-weight: 700; color: var(--ink); margin: 0 0 8px; }
	.card-hint { font-size: 0.8rem; color: var(--ink-2); line-height: 1.6; margin: 0 0 12px; }
	.muted-card { text-align: center; }
	.upsell { display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--ink-2); margin: 0 0 12px; }

	.err { background: #fef2f2; color: var(--accent-deep); border: 1px solid #fecaca; border-radius: 10px; padding: 8px 12px; font-size: 0.82rem; margin: 0 0 12px; }

	.field { display: block; margin-bottom: 12px; }
	.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
	.field-label { display: block; font-size: 0.78rem; font-weight: 600; color: var(--ink); margin-bottom: 5px; }
	.input { width: 100%; box-sizing: border-box; padding: 10px 13px; border: 1px solid var(--line-strong); border-radius: 10px; font-size: 0.95rem; font-family: inherit; background: var(--surface); color: var(--ink); }
	.input:focus { outline: 2px solid var(--accent); border-color: transparent; }
	.code-input { text-transform: uppercase; letter-spacing: 0.12em; }
	.fine { font-size: 0.72rem; color: var(--ink-3); margin: 0 0 12px; }

	.join-row { display: flex; gap: 10px; }
	.join-row .input { flex: 1; }
	.form-actions { display: flex; gap: 10px; }

	.btn { display: inline-flex; align-items: center; justify-content: center; padding: 10px 18px; border-radius: 10px; font-size: 0.9rem; font-weight: 600; font-family: inherit; cursor: pointer; border: none; background: var(--accent); color: #fff; text-decoration: none; white-space: nowrap; }
	.btn:hover:not(:disabled) { background: var(--accent-deep); }
	.btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.btn.ghost { background: none; border: 1px solid var(--line-strong); color: var(--ink); }
	.btn.ghost:hover:not(:disabled) { background: var(--surface-sunk); }
	.btn.sm { padding: 7px 14px; font-size: 0.82rem; }

	.group-list { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
	.group-item { display: flex; align-items: center; gap: 12px; padding: 14px; border: 1px solid var(--line); border-radius: 12px; text-decoration: none; color: inherit; transition: border-color 0.15s, background 0.15s; }
	.group-item:hover { border-color: var(--accent); background: var(--accent-tint); }
	.gi-main { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
	.gi-name { font-size: 0.95rem; font-weight: 700; color: var(--ink); }
	.gi-badge { display: inline-block; font-size: 0.64rem; font-weight: 700; padding: 1px 7px; border-radius: 20px; margin-left: 6px; }
	.gi-badge.owner { background: rgba(181,137,46,0.16); color: #8a6a1e; }
	.gi-badge.ended { background: var(--surface-sunk); color: var(--ink-3); }
	.gi-desc { font-size: 0.78rem; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.gi-meta { font-size: 0.72rem; color: var(--ink-3); }
	.gi-arrow { font-size: 1.4rem; color: var(--ink-3); }
</style>
