<!-- 屋台の接続タグ（NFC書き込み用URL＆印刷用QR）を発行するページ -->
<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';

	const stallId = $derived($page.params.stallId);

	let stallName = $state('');
	let connectUrl = $state('');
	let qr = $state('');
	let notFound = $state(false);
	let loading = $state(true);

	onMount(async () => {
		const { data: stall } = await supabase
			.from('stall_specs').select('stall_name').eq('id', stallId).maybeSingle();
		if (!stall) { notFound = true; loading = false; return; }

		stallName = stall.stall_name ?? '屋台';
		connectUrl = `${window.location.origin}${base}/connect?stall=${stallId}`;

		try {
			const QRCode = (await import('qrcode')).default;
			qr = await QRCode.toDataURL(connectUrl, { margin: 1, width: 320 });
		} catch { /* noop */ }
		loading = false;
	});

	async function copyUrl() {
		try { await navigator.clipboard.writeText(connectUrl); } catch { /* noop */ }
	}
</script>

<svelte:head><title>接続タグ発行 | 夜行人ネットワーク</title></svelte:head>

<main>
	{#if loading}
		<p class="muted">読み込み中…</p>
	{:else if notFound}
		<p class="muted">屋台が見つかりませんでした。</p>
	{:else}
		<h1 class="title">接続タグ</h1>
		<p class="stall-name">🏮 {stallName}</p>

		<div class="qr-card">
			{#if qr}<img src={qr} alt="接続QRコード" class="qr" />{/if}
			<p class="card-name">{stallName} とつながる</p>
			<p class="card-sub">夜行人ネットワーク · 微小夜行電灯</p>
		</div>

		<div class="url-row">
			<input type="text" readonly value={connectUrl} />
			<button onclick={copyUrl}>コピー</button>
		</div>

		<section class="howto">
			<h2>使い方</h2>
			<ol>
				<li><strong>QRコード</strong>を印刷して屋台に掲示すれば、来場者がスマホのカメラで読み取って参加できます。</li>
				<li><strong>NFCタグ</strong>に上のURLを書き込めば、スマホをかざすだけで参加できます（iPhone / Android 両対応）。
					<br /><span class="muted">※ NFCタグへの書き込みは「NFC Tools」等のアプリで、種別「URL / URI」に上記URLを指定します。</span></li>
			</ol>
			<p class="privacy">読み取った人には初回のみ確認画面が出ます。共有されるのはニックネームと一言だけで、実名・連絡先は公開されません。</p>
		</section>

		<button class="print-btn" onclick={() => window.print()}>QRを印刷する</button>
	{/if}
</main>

<style>
	main { max-width: 15cm; margin: auto; padding: 2rem 16px 3rem; box-sizing: border-box; text-align: center; }
	.muted { color: #9e8f7a; font-size: 0.85rem; }
	.title { color: #26201a; margin-bottom: 0.4rem; }
	.stall-name { font-size: 1.05rem; color: #4a3f38; margin-bottom: 1.6rem; }

	.qr-card {
		display: inline-flex; flex-direction: column; align-items: center; gap: 8px;
		padding: 24px 28px; border: 2px solid #26201a; border-radius: 18px; background: #fff;
	}
	.qr { width: 240px; height: 240px; }
	.card-name { font-size: 1.05rem; font-weight: 800; color: #26201a; margin: 8px 0 0; }
	.card-sub { font-size: 0.72rem; color: #9e8f7a; margin: 0; letter-spacing: 0.04em; }

	.url-row { display: flex; gap: 8px; margin: 1.6rem auto 0; max-width: 440px; }
	.url-row input {
		flex: 1; border: 1px solid #ded3c4; border-radius: 8px; padding: 9px 11px;
		font-size: 0.78rem; color: #5a4f45; background: #faf8f5;
	}
	.url-row button {
		border: none; background: #26201a; color: #fff; border-radius: 8px;
		padding: 0 16px; font-size: 0.82rem; font-weight: 700; cursor: pointer;
	}

	.howto { text-align: left; margin: 2rem auto 0; max-width: 460px; }
	.howto h2 { font-size: 0.95rem; color: #26201a; margin-bottom: 0.6rem; }
	.howto ol { padding-left: 1.2rem; display: flex; flex-direction: column; gap: 10px; }
	.howto li { font-size: 0.85rem; color: #4a3f38; line-height: 1.6; }
	.privacy { font-size: 0.78rem; color: #6b5f54; background: #fff7ed; border-radius: 10px; padding: 12px 14px; margin-top: 14px; line-height: 1.6; }
	.muted { color: #9e8f7a; }

	.print-btn {
		margin-top: 1.8rem; padding: 12px 28px; border: none; border-radius: 100px;
		background: #d56d04; color: #fff; font-size: 0.9rem; font-weight: 700; cursor: pointer;
	}
	.print-btn:hover { background: #b85d03; }

	@media print {
		.url-row, .howto, .print-btn, .title, .stall-name { display: none; }
		.qr-card { border-color: #000; }
	}
</style>
