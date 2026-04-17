<script>
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';
	import { activateReservationBySpace } from '$lib/db.js';

	let userId = $state('');
	/** @type {'init'|'scanning'|'activating'|'success'|'error'} */
	let phase = $state('init');
	let errorMsg = $state('');
	let successData = $state(null);
	let html5QrCode = null;

	onMount(async () => {
		const {
			data: { session }
		} = await supabase.auth.getSession();
		if (!session) {
			goto(`${base}/auth`);
			return;
		}
		userId = session.user.id;

		// URL に ?space= がある場合はカメラ不要でそのままアクティベート
		const spaceId = new URLSearchParams(window.location.search).get('space');
		if (spaceId) {
			await activateFromSpaceId(spaceId);
		} else {
			await startCamera();
		}
	});

	onDestroy(() => {
		stopCamera();
	});

	async function startCamera() {
		phase = 'scanning';
		try {
			const { Html5Qrcode } = await import('html5-qrcode');
			html5QrCode = new Html5Qrcode('qr-reader');
			await html5QrCode.start(
				{ facingMode: 'environment' },
				{ fps: 10, qrbox: { width: 240, height: 240 } },
				async (text) => {
					stopCamera();
					await handleScannedText(text);
				},
				() => {} // フレームごとのエラーは無視
			);
		} catch (e) {
			phase = 'error';
			errorMsg = 'カメラの起動に失敗しました。カメラの使用を許可してください。';
		}
	}

	function stopCamera() {
		if (html5QrCode?.isScanning) {
			html5QrCode.stop().catch(() => {});
			html5QrCode = null;
		}
	}

	async function handleScannedText(text) {
		// URLからspace=パラメータを取り出す。直接UUIDの場合はそのまま使用
		let spaceId = text.trim();
		try {
			const url = new URL(text);
			spaceId = url.searchParams.get('space') ?? text.trim();
		} catch {
			// URLでない場合はtextをそのままspaceIdとして扱う
		}
		await activateFromSpaceId(spaceId);
	}

	async function activateFromSpaceId(spaceId) {
		phase = 'activating';
		try {
			const data = await activateReservationBySpace(userId, spaceId);
			successData = data;
			phase = 'success';
		} catch (e) {
			errorMsg = e.message;
			phase = 'error';
		}
	}

	async function retry() {
		errorMsg = '';
		await startCamera();
	}
</script>

<div class="scan-page">
	{#if phase === 'init' || phase === 'activating'}
		<div class="status-box">
			<div class="spinner"></div>
			<p>{phase === 'activating' ? '予約を確認しています…' : '準備中…'}</p>
		</div>

	{:else if phase === 'scanning'}
		<div class="scanner-wrapper">
			<h2 class="scan-title">QRコードをスキャン</h2>
			<p class="scan-hint">屋台・スペースに貼られたQRコードを<br />カメラに向けてください</p>
			<div id="qr-reader"></div>
			<button class="back-btn" onclick={() => goto(`${base}/map`)}>← 戻る</button>
		</div>

	{:else if phase === 'success'}
		<div class="status-box success">
			<div class="result-icon success-icon">✓</div>
			<h2 class="result-title">借り出し開始！</h2>
			<p class="space-name">{successData?.rental_spaces?.name ?? 'スペース'}</p>
			{#if successData?.stall_specs?.stall_name}
				<p class="stall-name">🏮 {successData.stall_specs.stall_name}</p>
			{/if}
			<p class="result-note">マップ上で「出店中」として表示されます</p>
			<button class="action-btn" onclick={() => goto(`${base}/map`)}>マップに戻る</button>
		</div>

	{:else if phase === 'error'}
		<div class="status-box error">
			<div class="result-icon error-icon">✕</div>
			<h2 class="result-title">エラーが発生しました</h2>
			<p class="error-msg">{errorMsg}</p>
			<button class="action-btn retry" onclick={retry}>もう一度スキャン</button>
			<button class="action-btn ghost" onclick={() => goto(`${base}/map`)}>マップに戻る</button>
		</div>
	{/if}
</div>

<style>
	.scan-page {
		min-height: 100svh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #faf8f5;
		padding: 20px;
	}

	/* ===== ローディング・共通ステータスボックス ===== */
	.status-box {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		padding: 40px 24px;
		background: #fff;
		border-radius: 16px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
		max-width: 360px;
		width: 100%;
	}

	.spinner {
		width: 48px;
		height: 48px;
		border: 4px solid #e8e0d8;
		border-top-color: #26201a;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* ===== スキャナー ===== */
	.scanner-wrapper {
		width: 100%;
		max-width: 400px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}

	.scan-title {
		font-size: 1.2rem;
		font-weight: 700;
		color: #26201a;
		margin: 0;
	}

	.scan-hint {
		font-size: 0.85rem;
		color: #7a6f67;
		text-align: center;
		line-height: 1.6;
		margin: 0;
	}

	#qr-reader {
		width: 100%;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
	}

	/* html5-qrcode のデフォルトUIを上書き */
	:global(#qr-reader video) {
		border-radius: 12px;
	}
	:global(#qr-reader__scan_region) {
		background: transparent !important;
	}

	.back-btn {
		margin-top: 8px;
		background: none;
		border: none;
		color: #7a6f67;
		font-size: 0.9rem;
		cursor: pointer;
		padding: 8px 16px;
	}

	/* ===== 結果画面 ===== */
	.result-icon {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
		font-weight: 700;
	}

	.success-icon {
		background: #e8f5e9;
		color: #2e7d32;
	}

	.error-icon {
		background: #fdecea;
		color: #c62828;
	}

	.result-title {
		font-size: 1.3rem;
		font-weight: 700;
		color: #26201a;
		margin: 0;
	}

	.space-name {
		font-size: 1.1rem;
		font-weight: 600;
		color: #26201a;
		margin: 0;
	}

	.stall-name {
		font-size: 0.95rem;
		color: #7a6f67;
		margin: 0;
	}

	.result-note {
		font-size: 0.8rem;
		color: #9e9289;
		margin: 0;
	}

	.error-msg {
		font-size: 0.9rem;
		color: #c62828;
		text-align: center;
		margin: 0;
		line-height: 1.5;
	}

	.action-btn {
		width: 100%;
		padding: 12px;
		border-radius: 10px;
		border: none;
		background: #26201a;
		color: #fff;
		font-size: 0.95rem;
		font-family: inherit;
		cursor: pointer;
	}

	.action-btn.retry {
		background: #c62828;
	}

	.action-btn.ghost {
		background: none;
		border: 1.5px solid #26201a;
		color: #26201a;
	}
</style>
