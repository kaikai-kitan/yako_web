<svelte:head>
	<title>出品申請管理 | 管理者</title>
</svelte:head>

<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';

	let applications = $state([]);
	let isLoading = $state(true);
	let msg = $state('');
	let errMsg = $state('');

	let rejectingId = $state(null);
	let rejectReason = $state('');
	let isProcessing = $state(false);

	onMount(async () => {
		await loadApplications();
	});

	async function loadApplications() {
		isLoading = true;
		const res = await fetch('/api/admin/applications');
		if (res.status === 403) {
			goto(`${base}/admin/login`);
			return;
		}
		const data = await res.json();
		applications = data.applications ?? [];
		isLoading = false;
	}

	async function approve(userId) {
		isProcessing = true;
		errMsg = '';
		const res = await fetch('/api/admin/applications', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userId, action: 'approve' })
		});
		isProcessing = false;
		if (res.ok) {
			msg = '承認しました';
			applications = applications.filter((a) => a.user_id !== userId);
			setTimeout(() => (msg = ''), 3000);
		} else {
			const d = await res.json().catch(() => ({}));
			errMsg = d.message ?? '承認に失敗しました';
		}
	}

	async function reject(userId) {
		if (!rejectReason.trim()) {
			errMsg = '却下理由を入力してください';
			return;
		}
		isProcessing = true;
		errMsg = '';
		const res = await fetch('/api/admin/applications', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userId, action: 'reject', reason: rejectReason })
		});
		isProcessing = false;
		if (res.ok) {
			msg = '却下しました';
			applications = applications.filter((a) => a.user_id !== userId);
			rejectingId = null;
			rejectReason = '';
			setTimeout(() => (msg = ''), 3000);
		} else {
			const d = await res.json().catch(() => ({}));
			errMsg = d.message ?? '却下に失敗しました';
		}
	}

	function fmtDate(iso) {
		if (!iso) return '—';
		return new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
	}

	function stars(rating) {
		if (!rating) return '—';
		return '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating)) + ` (${rating})`;
	}
</script>

<div class="page">
	<header class="top-bar">
		<a href="{base}/admin" class="back-link">← 管理ダッシュボード</a>
		<h1 class="page-title">出品申請管理</h1>
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
		{:else if applications.length === 0}
			<div class="empty">
				<p>現在、審査待ちの申請はありません。</p>
			</div>
		{:else}
			<p class="count-label">審査待ち {applications.length} 件</p>

			{#each applications as app}
				<div class="app-card">
					<div class="app-header">
						<div class="app-identity">
							<span class="app-business">{app.business_name}</span>
							<span class="app-name">{app.user_name}</span>
						</div>
						<span class="app-date">申請日: {fmtDate(app.applied_at)}</span>
					</div>

					<div class="app-stats">
						<div class="stat">
							<span class="stat-label">出店実績</span>
							<span class="stat-value" class:ok={app.completed_rentals >= 1}>
								{app.completed_rentals} 回
							</span>
						</div>
						<div class="stat">
							<span class="stat-label">レビュー平均</span>
							<span class="stat-value">{stars(app.avg_rating)}</span>
						</div>
						<div class="stat">
							<span class="stat-label">レビュー数</span>
							<span class="stat-value">{app.review_count} 件</span>
						</div>
					</div>

					{#if rejectingId === app.user_id}
						<div class="reject-form">
							<textarea
								class="reject-textarea"
								bind:value={rejectReason}
								placeholder="却下理由を入力してください（申請者に通知されます）"
								rows="3"
							></textarea>
							<div class="reject-actions">
								<button
									class="action-btn reject-confirm"
									onclick={() => reject(app.user_id)}
									disabled={isProcessing}
								>
									{isProcessing ? '処理中…' : '却下を確定'}
								</button>
								<button class="action-btn cancel" onclick={() => { rejectingId = null; rejectReason = ''; errMsg = ''; }}>
									キャンセル
								</button>
							</div>
						</div>
					{:else}
						<div class="app-actions">
							<button
								class="action-btn approve"
								onclick={() => approve(app.user_id)}
								disabled={isProcessing}
							>
								承認
							</button>
							<button
								class="action-btn reject-open"
								onclick={() => { rejectingId = app.user_id; rejectReason = ''; errMsg = ''; }}
								disabled={isProcessing}
							>
								却下…
							</button>
						</div>
					{/if}
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

	.empty {
		text-align: center; padding: 60px 20px;
		color: var(--ink-3); font-size: 0.9rem;
	}

	.app-card {
		background: white; border-radius: 14px;
		box-shadow: 0 2px 10px rgba(0,0,0,0.06);
		padding: 18px; margin-bottom: 14px;
	}

	.app-header {
		display: flex; justify-content: space-between; align-items: flex-start;
		margin-bottom: 14px; flex-wrap: wrap; gap: 6px;
	}
	.app-identity { display: flex; flex-direction: column; gap: 2px; }
	.app-business { font-size: 1rem; font-weight: 700; color: var(--ink); }
	.app-name { font-size: 0.8rem; color: var(--ink-2); }
	.app-date { font-size: 0.78rem; color: var(--ink-3); }

	.app-stats {
		display: flex; gap: 16px; flex-wrap: wrap;
		background: var(--surface-sunk); border-radius: 10px;
		padding: 12px; margin-bottom: 14px;
	}
	.stat { display: flex; flex-direction: column; gap: 2px; }
	.stat-label { font-size: 0.72rem; color: var(--ink-3); font-weight: 600; }
	.stat-value { font-size: 0.88rem; color: var(--ink); font-weight: 700; }
	.stat-value.ok { color: var(--ink-2); }

	.app-actions { display: flex; gap: 8px; }

	.action-btn {
		padding: 8px 18px; border-radius: 8px;
		font-size: 0.85rem; font-weight: 600;
		font-family: inherit; cursor: pointer; border: none;
	}
	.action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.action-btn.approve { background: var(--ink-2); color: white; }
	.action-btn.approve:hover:not(:disabled) { background: #14532d; }
	.action-btn.reject-open { background: white; color: var(--accent-deep); border: 1.5px solid #fecaca; }
	.action-btn.reject-open:hover:not(:disabled) { background: #fef2f2; }
	.action-btn.reject-confirm { background: var(--accent-deep); color: white; }
	.action-btn.reject-confirm:hover:not(:disabled) { background: #7f1d1d; }
	.action-btn.cancel { background: var(--surface-sunk); color: var(--ink-2); }

	.reject-form { margin-top: 4px; }
	.reject-textarea {
		width: 100%; box-sizing: border-box;
		border: 1.5px solid #fecaca; border-radius: 8px;
		padding: 10px 12px; font-size: 0.88rem;
		font-family: inherit; resize: vertical; outline: none;
		margin-bottom: 8px;
	}
	.reject-textarea:focus { border-color: var(--accent-deep); }
	.reject-actions { display: flex; gap: 8px; }
</style>
