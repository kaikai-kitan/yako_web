<svelte:head><title>グループネットワーク | 微小夜行電灯</title></svelte:head>

<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';
	import Icon from '$lib/components/Icon.svelte';
	import NetworkGraph3D from '$lib/components/NetworkGraph3D.svelte';

	let accessToken = $state('');
	let isLoading = $state(true);
	let errMsg = $state('');
	let group = $state(null);
	let graphData = $state(null);

	// 招待（作成者のみ）
	let joinCode = $state('');
	let qrDataUrl = $state('');
	let showInvite = $state(false);
	let copied = $state(false);

	const groupId = $page.params.id;

	onMount(async () => {
		const { data: { session } } = await supabase.auth.getSession();
		if (!session) { goto(`${base}/auth`); return; }
		accessToken = session.access_token;

		const res = await fetch(`/api/groups/${groupId}/graph`, { headers: { Authorization: `Bearer ${accessToken}` } });
		if (res.status === 403) { errMsg = 'このグループのメンバーのみ閲覧できます。'; isLoading = false; return; }
		if (!res.ok) { errMsg = 'グループを読み込めませんでした。'; isLoading = false; return; }
		const d = await res.json();
		group = d.group;
		graphData = { nodes: d.nodes ?? [], links: d.links ?? [] };

		if (group.is_owner) await loadInvite();
		isLoading = false;
	});

	async function loadInvite() {
		// 招待コードは mine から取得（作成者にのみ返る）
		const res = await fetch('/api/groups/mine', { headers: { Authorization: `Bearer ${accessToken}` } });
		if (!res.ok) return;
		const d = await res.json();
		const g = (d.groups ?? []).find((x) => x.id === groupId);
		if (g?.join_code) {
			joinCode = g.join_code;
			const url = `${window.location.origin}${base}/groups/join?g=${g.join_code}`;
			const QRCode = (await import('qrcode')).default;
			qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 240 });
		}
	}

	async function copyCode() {
		try { await navigator.clipboard.writeText(joinCode); copied = true; setTimeout(() => (copied = false), 2000); } catch { /* noop */ }
	}

	function fmtRange(s, e) {
		const f = (iso) => iso ? new Date(iso).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
		const a = f(s), b = f(e);
		if (a && b) return `${a} 〜 ${b}`;
		if (b) return `〜 ${b}`;
		if (a) return `${a} 〜`;
		return '期間未設定';
	}
	let ended = $derived(group?.ends_at && new Date(group.ends_at).getTime() < Date.now());
</script>

<div class="wrap">
	<div class="topbar">
		<a class="back" href="{base}/groups">← グループ一覧</a>
		{#if group}
			<div class="title-block">
				<span class="g-name">{group.name}</span>
				<span class="g-meta">{group.member_count}人 ・ {fmtRange(group.starts_at, group.ends_at)}{#if ended} ・ 受付終了{/if}</span>
			</div>
		{/if}
		{#if group?.is_owner}
			<button class="invite-btn" onclick={() => (showInvite = !showInvite)}><Icon name="qr-code" size={16} /> 招待</button>
		{/if}
	</div>

	{#if isLoading}
		<p class="center">読み込み中…</p>
	{:else if errMsg}
		<p class="center err">{errMsg}</p>
	{:else}
		{#if graphData && (graphData.nodes.length > 1 || graphData.links.length > 0)}
			<div class="graph-host">
				<NetworkGraph3D data={graphData} onNodeClick={() => {}} height="72vh" />
			</div>
		{:else}
			<div class="center empty">
				<p>まだ縁がありません。</p>
				<p class="empty-sub">メンバーどうしがQRで繋がると、ここに星図として表示されます。</p>
			</div>
		{/if}
	{/if}

	<!-- 招待パネル（作成者） -->
	{#if showInvite && joinCode}
		<div class="invite-overlay" onclick={(e) => e.target === e.currentTarget && (showInvite = false)} role="presentation">
			<div class="invite-card">
				<button class="invite-close" onclick={() => (showInvite = false)} aria-label="閉じる">×</button>
				<h3 class="invite-title">グループに招待</h3>
				<p class="invite-hint">このQRを読み取るか、コードを共有して参加してもらいましょう。</p>
				{#if qrDataUrl}<img class="invite-qr" src={qrDataUrl} alt="招待QR" />{/if}
				<div class="code-box">
					<span class="code-val">{joinCode}</span>
					<button class="copy-btn" onclick={copyCode}>{copied ? 'コピー済' : 'コピー'}</button>
				</div>
				{#if ended}<p class="invite-ended">※ 受付は終了しています（新規参加はできません）。</p>{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.wrap { min-height: 100svh; background: var(--paper); display: flex; flex-direction: column; }
	.topbar {
		position: sticky; top: 0; z-index: 5;
		display: flex; align-items: center; gap: 14px; padding: 12px 18px;
		background: rgba(250,248,245,0.96); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line);
	}
	.back { font-size: 0.82rem; color: var(--ink-2); text-decoration: none; white-space: nowrap; }
	.back:hover { color: var(--ink); }
	.title-block { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
	.g-name { font-family: "Zen Antique", serif; font-size: 1rem; color: var(--ink); letter-spacing: 0.04em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.g-meta { font-size: 0.7rem; color: var(--ink-3); }
	.invite-btn { display: inline-flex; align-items: center; gap: 5px; padding: 7px 13px; border-radius: 100px; border: none; background: var(--accent); color: #fff; font-size: 0.8rem; font-weight: 700; font-family: inherit; cursor: pointer; white-space: nowrap; }
	.invite-btn:hover { background: var(--accent-deep); }

	.graph-host { flex: 1; }
	.center { text-align: center; color: var(--ink-3); padding: 60px 20px; }
	.center.err { color: var(--accent-deep); }
	.empty { display: flex; flex-direction: column; gap: 6px; }
	.empty-sub { font-size: 0.8rem; color: var(--ink-3); }

	.invite-overlay { position: fixed; inset: 0; z-index: 50; background: rgba(20,16,12,0.55); display: flex; align-items: center; justify-content: center; padding: 20px; }
	.invite-card { position: relative; background: var(--surface); border-radius: 18px; padding: 26px 24px; width: 100%; max-width: 320px; text-align: center; box-shadow: var(--shadow-2); }
	.invite-close { position: absolute; top: 12px; right: 14px; background: none; border: none; font-size: 1.4rem; color: var(--ink-3); cursor: pointer; line-height: 1; }
	.invite-title { font-family: "Zen Antique", serif; font-size: 1.1rem; color: var(--ink); margin: 0 0 6px; }
	.invite-hint { font-size: 0.78rem; color: var(--ink-2); line-height: 1.6; margin: 0 0 16px; }
	.invite-qr { width: 200px; height: 200px; border-radius: 12px; border: 1px solid var(--line); margin: 0 auto 14px; display: block; }
	.code-box { display: flex; align-items: center; gap: 8px; justify-content: center; }
	.code-val { font-size: 1.15rem; font-weight: 800; letter-spacing: 0.16em; color: var(--ink); font-family: monospace; }
	.copy-btn { padding: 5px 12px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--surface-sunk); color: var(--ink); font-size: 0.76rem; font-family: inherit; cursor: pointer; }
	.copy-btn:hover { border-color: var(--accent); color: var(--accent); }
	.invite-ended { font-size: 0.72rem; color: var(--accent-deep); margin: 12px 0 0; }
</style>
