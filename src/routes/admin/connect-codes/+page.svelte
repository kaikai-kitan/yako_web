<svelte:head>
	<title>接続コード（NFC）管理 | 管理者</title>
</svelte:head>

<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';

	let codes = $state([]);
	let isLoading = $state(true);
	let origin = $state('');
	let copiedId = $state('');

	onMount(async () => {
		origin = window.location.origin;
		const res = await fetch('/api/admin/connect-codes');
		if (res.status === 403) { goto(`${base}/admin/login`); return; }
		const data = await res.json();
		codes = data.codes ?? [];
		isLoading = false;
	});

	function connectUrl(code) {
		return `${origin}${base}/connect?u=${code}`;
	}

	async function copyOne(row) {
		try {
			await navigator.clipboard.writeText(connectUrl(row.connect_code));
			copiedId = row.user_id;
			setTimeout(() => (copiedId = ''), 1500);
		} catch { /* noop */ }
	}

	// CSV（名前, ニックネーム, 接続URL）をまとめてコピー＝NFC書き込み・在庫管理用
	async function copyAllCsv() {
		const header = 'name,handle,connect_url';
		const lines = codes
			.filter((c) => c.connect_code)
			.map((c) => `"${(c.name ?? '').replace(/"/g, '""')}","${(c.handle ?? '').replace(/"/g, '""')}","${connectUrl(c.connect_code)}"`);
		try {
			await navigator.clipboard.writeText([header, ...lines].join('\n'));
			copiedId = '__all__';
			setTimeout(() => (copiedId = ''), 1500);
		} catch { /* noop */ }
	}
</script>

<div class="page">
	<a href="{base}/admin" class="back">← 管理者ダッシュボード</a>
	<div class="head">
		<h1 class="page-title">接続コード（NFC）管理</h1>
		{#if codes.length > 0}
			<button class="csv-btn" onclick={copyAllCsv}>
				{copiedId === '__all__' ? 'コピーしました' : '全件CSVコピー'}
			</button>
		{/if}
	</div>
	<p class="lead">
		各夜行人の接続URLです。NFCタグ（カードキー）にこのURLを書き込むと、スマホでタッチした相手とその場で繋がれます。
		<strong>このURLはユーザー画面には表示されません。</strong>
	</p>

	{#if isLoading}
		<p class="muted">読み込み中…</p>
	{:else if codes.length === 0}
		<p class="muted">登録された夜行人がまだいません。</p>
	{:else}
		<div class="table-wrap">
			<table>
				<thead>
					<tr><th>名前</th><th>ニックネーム</th><th>接続URL</th><th>公開</th><th></th></tr>
				</thead>
				<tbody>
					{#each codes as row}
						<tr>
							<td>{row.name || '—'}</td>
							<td>{row.handle || '—'}</td>
							<td class="url-cell">
								{#if row.connect_code}
									<code>{connectUrl(row.connect_code)}</code>
								{:else}
									<span class="muted">未発行</span>
								{/if}
							</td>
							<td>{row.is_public ? '公開' : '非公開'}</td>
							<td>
								{#if row.connect_code}
									<button class="copy-btn" onclick={() => copyOne(row)}>
										{copiedId === row.user_id ? '✓' : 'コピー'}
									</button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.page { max-width: 900px; margin: 0 auto; padding: 20px 16px 80px; }
	.back { display: inline-block; font-size: 0.85rem; color: var(--ink-2); text-decoration: none; margin-bottom: 16px; }
	.back:hover { color: var(--accent); }
	.head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
	.page-title { font-family: "Zen Antique", serif; font-size: 1.4rem; color: var(--ink); margin: 0; }
	.lead { font-size: 0.85rem; color: var(--ink-2); line-height: 1.7; margin: 10px 0 20px; }
	.muted { color: var(--ink-3); font-size: 0.9rem; }

	.csv-btn {
		flex-shrink: 0; padding: 9px 16px; background: var(--accent); color: #fff;
		border: none; border-radius: var(--r-md); font-size: 0.82rem; font-weight: 600;
		font-family: inherit; cursor: pointer; transition: background 0.15s;
	}
	.csv-btn:hover { background: var(--accent-deep); }

	.table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--r-md); }
	table { width: 100%; border-collapse: collapse; font-size: 0.85rem; background: var(--surface); }
	th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line); white-space: nowrap; }
	th { background: var(--surface-sunk); color: var(--ink-2); font-weight: 600; font-size: 0.78rem; }
	td { color: var(--ink); }
	.url-cell code { font-size: 0.76rem; color: var(--ink-2); background: var(--surface-sunk); padding: 3px 7px; border-radius: 5px; }
	.copy-btn {
		padding: 5px 12px; background: none; border: 1px solid var(--line-strong);
		color: var(--ink-2); border-radius: 6px; font-size: 0.78rem; cursor: pointer;
		font-family: inherit; transition: all 0.15s;
	}
	.copy-btn:hover { border-color: var(--accent); color: var(--accent); }
</style>
