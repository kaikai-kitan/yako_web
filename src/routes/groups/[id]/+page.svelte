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

		if (group.my_role === 'owner' || group.my_role === 'sub_admin') await loadInvite();
		isLoading = false;
	});

	async function loadInvite() {
		// 招待コードは mine から取得（作成者にのみ返る）
		const res = await fetch('/api/groups/mine', { headers: { Authorization: `Bearer ${accessToken}` } });
		if (!res.ok) return;
		const d = await res.json();
		const g = (d.groups ?? []).find((x) => x.id === groupId);
		if (g) pendingBadge = g.pending_count ?? 0;
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
	let isManager = $derived(group?.my_role === 'owner' || group?.my_role === 'sub_admin');
	let isOwnerRole = $derived(group?.my_role === 'owner');

	// ── 管理パネル ──
	let showManage = $state(false);
	let manageLoading = $state(false);
	let manageErr = $state('');
	let manageBusy = $state(false);
	let pendingList = $state([]);
	let memberList = $state([]);
	let pendingBadge = $state(0);

	// 編集フォーム
	let editName = $state('');
	let editDesc = $state('');
	let editStarts = $state('');
	let editEnds = $state('');
	let editPolicy = $state('approval');
	let editMsg = $state('');

	function toLocalInput(iso) {
		if (!iso) return '';
		const d = new Date(iso);
		const pad = (n) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	async function openManage() {
		showManage = true;
		editName = group.name ?? '';
		editDesc = group.description ?? '';
		editPolicy = group.join_policy ?? 'approval';
		editStarts = toLocalInput(group.starts_at);
		editEnds = toLocalInput(group.ends_at);
		await loadMembers();
	}

	async function loadMembers() {
		manageLoading = true; manageErr = '';
		try {
			const res = await fetch(`/api/groups/${groupId}/members`, { headers: { Authorization: `Bearer ${accessToken}` } });
			if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message ?? '読み込みに失敗しました'); }
			const d = await res.json();
			pendingList = d.pending ?? [];
			memberList = d.members ?? [];
			pendingBadge = pendingList.length;
		} catch (e) { manageErr = e.message; } finally { manageLoading = false; }
	}

	async function reloadGraph() {
		const res = await fetch(`/api/groups/${groupId}/graph`, { headers: { Authorization: `Bearer ${accessToken}` } });
		if (res.ok) { const d = await res.json(); group = d.group; graphData = { nodes: d.nodes ?? [], links: d.links ?? [] }; }
	}

	async function act(action, targetUserId, extra) {
		manageErr = ''; manageBusy = true;
		try {
			const res = await fetch(`/api/groups/${groupId}/manage`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
				body: JSON.stringify({ action, targetUserId, ...(extra ?? {}) })
			});
			const d = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(d.message ?? '操作に失敗しました');
			await loadMembers();
			await reloadGraph();
		} catch (e) { manageErr = e.message; } finally { manageBusy = false; }
	}

	async function saveEdit() {
		manageErr = ''; editMsg = ''; manageBusy = true;
		try {
			const res = await fetch(`/api/groups/${groupId}/manage`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
				body: JSON.stringify({ action: 'edit', name: editName, description: editDesc, startsAt: editStarts || null, endsAt: editEnds || null, joinPolicy: editPolicy })
			});
			const d = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(d.message ?? '保存に失敗しました');
			await reloadGraph();
			editMsg = 'グループ情報を更新しました。';
			setTimeout(() => (editMsg = ''), 3000);
		} catch (e) { manageErr = e.message; } finally { manageBusy = false; }
	}

	const roleLabel = (r) => r === 'owner' ? '主催' : r === 'sub_admin' ? '運営' : 'メンバー';
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
		{#if isManager}
			<button class="invite-btn ghost" onclick={openManage}><Icon name="clipboard-list" size={16} /> 管理{#if pendingBadge > 0}<span class="pill">{pendingBadge}</span>{/if}</button>
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

	<!-- 管理パネル（owner / sub_admin） -->
	{#if showManage}
		<div class="manage-overlay" onclick={(e) => e.target === e.currentTarget && (showManage = false)} role="presentation">
			<div class="manage-card">
				<div class="manage-head">
					<h3 class="manage-title">グループの管理</h3>
					<button class="invite-close" onclick={() => (showManage = false)} aria-label="閉じる">×</button>
				</div>

				{#if manageErr}<p class="m-err">{manageErr}</p>{/if}
				{#if manageLoading}
					<p class="center">読み込み中…</p>
				{:else}
					<!-- 参加申請 -->
					<section class="m-sec">
						<h4 class="m-h">参加申請 {#if pendingList.length}<span class="m-count">{pendingList.length}</span>{/if}</h4>
						{#if pendingList.length === 0}
							<p class="m-empty">承認待ちの申請はありません。</p>
						{:else}
							<ul class="m-list">
								{#each pendingList as p}
									<li class="m-row">
										<span class="m-avatar">{p.name?.charAt(0) ?? '?'}</span>
										<span class="m-name">{p.name}</span>
										<span class="m-actions">
											<button class="m-btn ok" onclick={() => act('approve', p.user_id)} disabled={manageBusy}>承認</button>
											<button class="m-btn ghost" onclick={() => act('reject', p.user_id)} disabled={manageBusy}>拒否</button>
										</span>
									</li>
								{/each}
							</ul>
						{/if}
					</section>

					<!-- メンバー -->
					<section class="m-sec">
						<h4 class="m-h">メンバー <span class="m-count light">{memberList.length}</span></h4>
						<ul class="m-list">
							{#each memberList as m}
								<li class="m-row">
									<span class="m-avatar">{m.name?.charAt(0) ?? '?'}</span>
									<span class="m-name">{m.name}<span class="m-role" class:owner={m.role === 'owner'} class:admin={m.role === 'sub_admin'}>{roleLabel(m.role)}</span></span>
									<span class="m-actions">
										{#if m.role !== 'owner'}
											{#if isOwnerRole}
												{#if m.role === 'sub_admin'}
													<button class="m-btn ghost" onclick={() => act('revoke_admin', m.user_id)} disabled={manageBusy}>運営解除</button>
												{:else}
													<button class="m-btn ghost" onclick={() => act('grant_admin', m.user_id)} disabled={manageBusy}>運営に指名</button>
												{/if}
											{/if}
											{#if isOwnerRole || m.role === 'member'}
												<button class="m-btn danger" onclick={() => confirm(`${m.name} をグループから外しますか？`) && act('remove', m.user_id)} disabled={manageBusy}>外す</button>
											{/if}
										{/if}
									</span>
								</li>
							{/each}
						</ul>
					</section>

					<!-- グループ設定 -->
					<section class="m-sec">
						<h4 class="m-h">グループ設定</h4>
						{#if editMsg}<p class="m-ok">{editMsg}</p>{/if}
						<label class="m-field"><span class="m-label">グループ名</span>
							<input class="m-input" bind:value={editName} maxlength="40" />
						</label>
						<label class="m-field"><span class="m-label">説明</span>
							<input class="m-input" bind:value={editDesc} maxlength="200" />
						</label>
						<div class="m-field-row">
							<label class="m-field"><span class="m-label">開始</span>
								<input class="m-input" type="datetime-local" bind:value={editStarts} />
							</label>
							<label class="m-field"><span class="m-label">終了</span>
								<input class="m-input" type="datetime-local" bind:value={editEnds} />
							</label>
						</div>
						<div class="m-field">
							<span class="m-label">参加方式</span>
							<div class="m-policy">
								<button type="button" class="m-pol" class:on={editPolicy === 'approval'} onclick={() => (editPolicy = 'approval')}>承認制</button>
								<button type="button" class="m-pol" class:on={editPolicy === 'open'} onclick={() => (editPolicy = 'open')}>即参加</button>
							</div>
						</div>
						<button class="m-btn save" onclick={saveEdit} disabled={manageBusy}>設定を保存</button>

						{#if isOwnerRole}
							<div class="m-close-row">
								<button class="m-btn ghost" onclick={() => act(group.is_closed ? 'reopen' : 'close')} disabled={manageBusy}>
									{group.is_closed ? '受付を再開する' : '受付を締め切る'}
								</button>
								<span class="m-close-note">{group.is_closed ? '現在は受付終了中です。' : '締め切ると新規参加・申請ができなくなります（閲覧は可能）。'}</span>
							</div>
						{/if}
					</section>
				{/if}
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
	.invite-btn.ghost { background: var(--surface); color: var(--ink); border: 1px solid var(--line-strong); }
	.invite-btn.ghost:hover { border-color: var(--accent); color: var(--accent); background: var(--surface); }
	.pill { display: inline-flex; align-items: center; justify-content: center; min-width: 17px; height: 17px; padding: 0 4px; border-radius: 100px; background: var(--accent); color: #fff; font-size: 0.66rem; font-weight: 800; margin-left: 2px; }

	.manage-overlay { position: fixed; inset: 0; z-index: 50; background: rgba(20,16,12,0.55); display: flex; align-items: flex-start; justify-content: center; padding: 20px; overflow-y: auto; }
	.manage-card { position: relative; background: var(--surface); border-radius: 18px; padding: 22px; width: 100%; max-width: 460px; box-shadow: var(--shadow-2); margin: auto; }
	.manage-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
	.manage-title { font-family: "Zen Antique", serif; font-size: 1.15rem; color: var(--ink); margin: 0; }
	.m-err { background: #fef2f2; color: var(--accent-deep); border: 1px solid #fecaca; border-radius: 8px; padding: 8px 12px; font-size: 0.8rem; margin: 0 0 12px; }
	.m-ok { background: #ecfdf5; color: #14532d; border: 1px solid #bbf7d0; border-radius: 8px; padding: 7px 11px; font-size: 0.78rem; margin: 0 0 10px; }

	.m-sec { padding: 14px 0; border-top: 1px solid var(--line); }
	.m-sec:first-of-type { border-top: none; padding-top: 0; }
	.m-h { font-size: 0.82rem; font-weight: 700; color: var(--ink); margin: 0 0 10px; display: flex; align-items: center; gap: 7px; }
	.m-count { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 100px; background: var(--accent); color: #fff; font-size: 0.66rem; font-weight: 800; }
	.m-count.light { background: var(--surface-sunk); color: var(--ink-2); }
	.m-empty { font-size: 0.8rem; color: var(--ink-3); margin: 0; }

	.m-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
	.m-row { display: flex; align-items: center; gap: 10px; }
	.m-avatar { flex-shrink: 0; width: 30px; height: 30px; border-radius: 50%; background: var(--surface-sunk); color: var(--ink-2); font-size: 0.85rem; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }
	.m-name { flex: 1; min-width: 0; font-size: 0.85rem; color: var(--ink); display: inline-flex; align-items: center; gap: 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.m-role { font-size: 0.62rem; font-weight: 700; padding: 1px 7px; border-radius: 20px; background: var(--surface-sunk); color: var(--ink-3); flex-shrink: 0; }
	.m-role.owner { background: rgba(181,137,46,0.16); color: #8a6a1e; }
	.m-role.admin { background: rgba(95,122,82,0.16); color: #4a6a3a; }
	.m-actions { display: flex; gap: 6px; flex-shrink: 0; }

	.m-btn { padding: 5px 12px; border-radius: 8px; border: none; font-size: 0.74rem; font-weight: 700; font-family: inherit; cursor: pointer; white-space: nowrap; }
	.m-btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.m-btn.ok { background: var(--accent); color: #fff; }
	.m-btn.ghost { background: var(--surface-sunk); color: var(--ink); border: 1px solid var(--line); }
	.m-btn.danger { background: none; color: var(--accent-deep); border: 1px solid #e6b8a8; }
	.m-btn.save { width: 100%; padding: 10px; background: var(--accent); color: #fff; margin-top: 4px; }
	.m-btn.save:hover:not(:disabled) { background: var(--accent-deep); }

	.m-field { display: block; margin-bottom: 10px; }
	.m-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
	.m-label { display: block; font-size: 0.74rem; font-weight: 600; color: var(--ink-2); margin-bottom: 5px; }
	.m-input { width: 100%; box-sizing: border-box; padding: 9px 11px; border: 1px solid var(--line-strong); border-radius: 9px; font-size: 0.88rem; font-family: inherit; background: var(--surface); color: var(--ink); }
	.m-input:focus { outline: 2px solid var(--accent); border-color: transparent; }
	.m-policy { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
	.m-pol { padding: 8px; border: 1.5px solid var(--line); border-radius: 9px; background: var(--surface); color: var(--ink-2); font-size: 0.8rem; font-weight: 600; font-family: inherit; cursor: pointer; }
	.m-pol.on { border-color: var(--accent); background: var(--accent-tint); color: var(--ink); }

	.m-close-row { margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--line); display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
	.m-close-note { font-size: 0.7rem; color: var(--ink-3); }

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
