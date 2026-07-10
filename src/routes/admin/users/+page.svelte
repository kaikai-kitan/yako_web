<svelte:head>
	<title>ユーザー管理 | 管理者</title>
</svelte:head>

<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';

	let users = $state([]);
	let isLoading = $state(true);
	let msg = $state('');
	let errMsg = $state('');
	let isProcessing = $state(false);

	onMount(async () => {
		await loadUsers();
	});

	async function loadUsers() {
		isLoading = true;
		const res = await fetch('/api/admin/users');
		if (res.status === 403) {
			goto(`${base}/admin/login`);
			return;
		}
		const data = await res.json();
		users = data.users ?? [];
		isLoading = false;
	}

	async function resetScore(userId) {
		if (!confirm('このユーザーの信用スコアをリセット（300）し、停止を解除しますか？')) return;
		isProcessing = true;
		errMsg = '';
		const res = await fetch('/api/admin/users', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userId, action: 'reset_score' })
		});
		isProcessing = false;
		if (res.ok) {
			msg = 'スコアをリセットしました';
			users = users.map((u) => u.user_id === userId ? { ...u, credit_score: 300, is_suspended: false } : u);
			setTimeout(() => (msg = ''), 3000);
		} else {
			const d = await res.json().catch(() => ({}));
			errMsg = d.message ?? 'リセットに失敗しました';
		}
	}

	async function unsuspend(userId) {
		if (!confirm('このユーザーのアカウント停止を解除しますか？')) return;
		isProcessing = true;
		errMsg = '';
		const res = await fetch('/api/admin/users', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userId, action: 'unsuspend' })
		});
		isProcessing = false;
		if (res.ok) {
			msg = '停止を解除しました';
			users = users.map((u) => u.user_id === userId ? { ...u, is_suspended: false } : u);
			setTimeout(() => (msg = ''), 3000);
		} else {
			const d = await res.json().catch(() => ({}));
			errMsg = d.message ?? '解除に失敗しました';
		}
	}

	async function toggleCorporate(user) {
		const enable = user.account_type !== 'corporate';
		const label = enable
			? 'このユーザーを法人アカウントとして有効化（広告表示ON）しますか？'
			: 'このユーザーの法人アカウントを解除（一般アカウント化・広告OFF）しますか？';
		if (!confirm(label)) return;
		isProcessing = true;
		errMsg = '';
		const res = await fetch('/api/admin/users', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userId: user.user_id, action: enable ? 'enable_corporate' : 'disable_corporate' })
		});
		isProcessing = false;
		if (res.ok) {
			msg = enable ? '法人アカウントを有効化しました' : '法人アカウントを解除しました';
			users = users.map((u) => u.user_id === user.user_id
				? { ...u, account_type: enable ? 'corporate' : 'individual', ad_active: enable, corp_status: enable ? 'approved' : 'none' }
				: u);
			setTimeout(() => (msg = ''), 3000);
		} else {
			const d = await res.json().catch(() => ({}));
			errMsg = d.message ?? '更新に失敗しました';
		}
	}

	function scoreClass(score) {
		if (score >= 200) return 'score-good';
		if (score >= 100) return 'score-warn';
		return 'score-danger';
	}

	function fmtDate(iso) {
		if (!iso) return '—';
		return new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
	}
</script>

<div class="page">
	<header class="top-bar">
		<a href="{base}/admin" class="back-link">← 管理ダッシュボード</a>
		<h1 class="page-title">ユーザー管理</h1>
	</header>

	{#if msg}
		<div class="toast success">{msg}</div>
	{/if}
	{#if errMsg}
		<div class="toast error">{errMsg}</div>
	{/if}

	<div class="content">
		{#if isLoading}
			<div class="empty">読み込み中…</div>
		{:else if users.length === 0}
			<div class="empty"><p>ユーザーが見つかりません。</p></div>
		{:else}
			<p class="count-label">{users.length} 件 / 停止中 {users.filter((u) => u.is_suspended).length} 件</p>

			{#each users as user}
				<div class="user-card" class:suspended={user.is_suspended}>
					<div class="user-header">
						<div class="user-identity">
							<span class="user-name">{user.name ?? '（名前なし）'}</span>
							{#if user.account_type === 'corporate'}
								<span class="corp-badge-adm">法人{user.ad_active ? '・広告ON' : ''}</span>
							{/if}
							{#if user.is_suspended}
								<span class="suspended-badge">アカウント停止中</span>
							{/if}
						</div>
						<span class="user-joined">登録: {fmtDate(user.created_at)}</span>
					</div>

					<div class="score-row">
						<span class="score-label">信用スコア</span>
						<span class="score-value {scoreClass(user.credit_score)}">{user.credit_score ?? 300}</span>
						<div class="score-bar-wrap">
							<div
								class="score-bar {scoreClass(user.credit_score)}"
								style="width: {Math.max(0, Math.min(100, ((user.credit_score ?? 300) / 300) * 100))}%"
							></div>
						</div>
					</div>

					<div class="user-actions">
						{#if user.is_suspended}
							<button
								class="action-btn unsuspend"
								onclick={() => unsuspend(user.user_id)}
								disabled={isProcessing}
							>
								停止解除
							</button>
						{/if}
						<button
							class="action-btn reset"
							onclick={() => resetScore(user.user_id)}
							disabled={isProcessing}
						>
							スコアリセット (→300)
						</button>
						<button
							class="action-btn corp"
							onclick={() => toggleCorporate(user)}
							disabled={isProcessing}
						>
							{user.account_type === 'corporate' ? '法人を解除' : '法人を有効化'}
						</button>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.page {
		min-height: 100svh;
		background: var(--surface-sunk);
		font-family: sans-serif;
		padding-bottom: 60px;
	}

	.top-bar {
		position: sticky; top: 0; z-index: 10;
		background: rgba(250,248,245,0.97);
		backdrop-filter: blur(8px);
		border-bottom: 1px solid var(--line);
		display: flex; align-items: center; gap: 16px;
		padding: 12px 20px;
	}
	.back-link { font-size: 0.82rem; color: var(--ink-2); text-decoration: none; }
	.back-link:hover { color: var(--ink); }
	.page-title { font-size: 1rem; font-weight: 700; color: var(--ink); margin: 0; }

	.toast {
		margin: 12px 20px; padding: 10px 16px;
		border-radius: 10px; font-size: 0.88rem;
	}
	.toast.success { background: #ecfdf5; color: var(--ink-2); border: 1px solid #bbf7d0; }
	.toast.error   { background: #fef2f2; color: var(--accent-deep); border: 1px solid #fecaca; }

	.content { padding: 16px 20px; max-width: 720px; margin: 0 auto; }
	.count-label { font-size: 0.82rem; color: var(--ink-2); margin: 0 0 12px; }
	.empty { text-align: center; padding: 60px 20px; color: var(--ink-3); font-size: 0.9rem; }

	.user-card {
		background: white; border-radius: 14px;
		box-shadow: 0 2px 10px rgba(0,0,0,0.06);
		padding: 16px; margin-bottom: 12px;
		border: 1px solid var(--surface-sunk);
	}
	.user-card.suspended { border-color: #fecaca; background: #fff8f8; }

	.user-header {
		display: flex; justify-content: space-between; align-items: flex-start;
		margin-bottom: 12px; flex-wrap: wrap; gap: 4px;
	}
	.user-identity { display: flex; align-items: center; gap: 8px; }
	.user-name { font-size: 0.95rem; font-weight: 700; color: var(--ink); }
	.suspended-badge {
		font-size: 0.68rem; background: #fecaca; color: var(--accent-deep);
		border-radius: 4px; padding: 2px 6px; font-weight: 700;
	}
	.user-joined { font-size: 0.75rem; color: var(--ink-3); }

	.score-row {
		display: flex; align-items: center; gap: 10px;
		margin-bottom: 12px;
	}
	.score-label { font-size: 0.75rem; color: var(--ink-3); font-weight: 600; white-space: nowrap; }
	.score-value { font-size: 1rem; font-weight: 800; min-width: 36px; text-align: right; }
	.score-value.score-good { color: var(--ink-2); }
	.score-value.score-warn { color: var(--accent-deep); }
	.score-value.score-danger { color: var(--accent-deep); }
	.score-bar-wrap {
		flex: 1; height: 8px; background: var(--surface-sunk);
		border-radius: 4px; overflow: hidden;
	}
	.score-bar { height: 100%; border-radius: 4px; transition: width 0.3s; }
	.score-bar.score-good { background: #22c55e; }
	.score-bar.score-warn { background: #f59e0b; }
	.score-bar.score-danger { background: var(--accent-deep); }

	.user-actions { display: flex; gap: 8px; }

	.action-btn {
		padding: 7px 14px; border-radius: 8px;
		font-size: 0.82rem; font-weight: 600;
		font-family: inherit; cursor: pointer; border: none;
	}
	.action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.action-btn.unsuspend { background: var(--ink-2); color: white; }
	.action-btn.unsuspend:hover:not(:disabled) { background: #14532d; }
	.action-btn.corp { background: #b5892e; color: white; }
	.action-btn.corp:hover:not(:disabled) { background: #9a7325; }
	.corp-badge-adm {
		font-size: 0.68rem; font-weight: 700; color: #8a6a1e;
		background: rgba(181, 137, 46, 0.14); border: 1px solid rgba(181, 137, 46, 0.4);
		padding: 2px 8px; border-radius: 20px;
	}
	.action-btn.reset { background: var(--surface-sunk); color: var(--ink); border: 1px solid var(--line); }
	.action-btn.reset:hover:not(:disabled) { background: #ede8e2; }
</style>
