<svelte:head><title>グループに参加 | 微小夜行電灯</title></svelte:head>

<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';
	import Icon from '$lib/components/Icon.svelte';

	let accessToken = $state('');
	let isLoading = $state(true);
	let group = $state(null);
	let errMsg = $state('');
	let busy = $state(false);

	let code = $state('');

	onMount(async () => {
		code = ($page.url.searchParams.get('g') ?? '').trim().toUpperCase();
		const { data: { session } } = await supabase.auth.getSession();
		if (!session) {
			// ログイン後にこの参加ページへ戻す
			goto(`${base}/auth?redirectTo=${encodeURIComponent(`${base}/groups/join?g=${code}`)}`);
			return;
		}
		accessToken = session.access_token;

		if (!code) { errMsg = '招待コードがありません。'; isLoading = false; return; }
		const res = await fetch(`/api/groups/lookup?code=${encodeURIComponent(code)}`);
		if (!res.ok) { errMsg = 'グループが見つかりません。コードをご確認ください。'; isLoading = false; return; }
		group = await res.json();
		isLoading = false;
	});

	async function join() {
		errMsg = ''; busy = true;
		try {
			const res = await fetch('/api/groups/join', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
				body: JSON.stringify({ code })
			});
			const d = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(d.message ?? '参加に失敗しました');
			goto(`${base}/groups/${d.groupId}`);
		} catch (e) { errMsg = e.message; busy = false; }
	}
</script>

<div class="page">
	<div class="card">
		{#if isLoading}
			<p class="center">読み込み中…</p>
		{:else if errMsg && !group}
			<div class="icon-badge err"><Icon name="alert-triangle" size={26} /></div>
			<p class="msg">{errMsg}</p>
			<a class="btn ghost" href="{base}/groups">グループ一覧へ</a>
		{:else if group}
			<div class="icon-badge"><Icon name="handshake" size={26} /></div>
			<span class="kicker">グループに参加</span>
			<h1 class="g-name">{group.name}</h1>
			{#if group.description}<p class="g-desc">{group.description}</p>{/if}
			<p class="g-meta">{group.member_count}人が参加中</p>

			{#if group.closed}
				<p class="closed">このグループは受付を終了しています。</p>
				<a class="btn ghost" href="{base}/groups">グループ一覧へ</a>
			{:else}
				{#if errMsg}<p class="err-inline">{errMsg}</p>{/if}
				<button class="btn" onclick={join} disabled={busy}>{busy ? '参加中…' : 'このグループに参加する'}</button>
				<p class="fine">無課金のアカウントでも参加できます。</p>
			{/if}
		{/if}
	</div>
</div>

<style>
	.page { min-height: 82vh; display: flex; align-items: center; justify-content: center; padding: 24px 16px; background: var(--paper); }
	.card { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 34px 28px; width: 100%; max-width: 380px; text-align: center; box-shadow: var(--shadow-2); }
	.center { color: var(--ink-3); }
	.icon-badge { width: 56px; height: 56px; border-radius: 50%; background: var(--accent-tint); color: var(--accent-deep); display: inline-flex; align-items: center; justify-content: center; margin: 0 auto 14px; }
	.icon-badge.err { background: #fef2f2; color: var(--accent-deep); }
	.kicker { display: block; font-size: 0.7rem; letter-spacing: 0.24em; color: var(--accent); margin-bottom: 6px; }
	.g-name { font-family: "Zen Antique", serif; font-size: 1.3rem; color: var(--ink); margin: 0 0 8px; letter-spacing: 0.04em; }
	.g-desc { font-size: 0.85rem; color: var(--ink-2); line-height: 1.6; margin: 0 0 8px; }
	.g-meta { font-size: 0.78rem; color: var(--ink-3); margin: 0 0 20px; }
	.msg { font-size: 0.9rem; color: var(--ink-2); margin: 0 0 18px; }
	.closed { font-size: 0.85rem; color: var(--accent-deep); margin: 0 0 16px; }
	.err-inline { font-size: 0.82rem; color: var(--accent-deep); margin: 0 0 12px; }
	.fine { font-size: 0.72rem; color: var(--ink-3); margin: 12px 0 0; }

	.btn { display: inline-block; width: 100%; box-sizing: border-box; padding: 13px; border-radius: 12px; border: none; background: var(--accent); color: #fff; font-size: 0.95rem; font-weight: 700; font-family: inherit; cursor: pointer; text-decoration: none; }
	.btn:hover:not(:disabled) { background: var(--accent-deep); }
	.btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.btn.ghost { background: none; border: 1px solid var(--line-strong); color: var(--ink); }
	.btn.ghost:hover { background: var(--surface-sunk); }
</style>
