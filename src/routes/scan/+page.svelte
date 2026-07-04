<script>
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';

	/** @type {'init'|'scanning'|'gps'|'loading'|'success'|'error'} */
	let phase = $state('init');
	let errorMsg = $state('');
	/** @type {{ action: 'checkin'|'return', name: string } | null} */
	let resultData = $state(null);
	let html5QrCode = null;
	let accessToken = '';

	onMount(async () => {
		const {
			data: { session }
		} = await supabase.auth.getSession();
		if (!session) {
			goto(`${base}/auth`);
			return;
		}
		accessToken = session.access_token;

		const params = new URLSearchParams(window.location.search);
		const spaceId = params.get('space');
		const yataiId = params.get('yatai');

		if (yataiId) {
			await processTarget('yatai', yataiId);
		} else if (spaceId) {
			await processTarget('space', spaceId);
		} else {
			await startCamera();
		}
	});

	onDestroy(() => {
		stopCamera();
	});

	/** GPS 座標を取得する。タイムアウト 10 秒。失敗時は null を返す。 */
	function getGPS() {
		return new Promise((resolve) => {
			if (!navigator.geolocation) {
				resolve(null);
				return;
			}
			navigator.geolocation.getCurrentPosition(
				(pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
				() => resolve(null),
				{ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
			);
		});
	}

	/** type ('space'|'yatai') と id を受け取り、GPS 取得 → scan-action 呼び出し */
	async function processTarget(type, id) {
		phase = 'gps';
		const coords = await getGPS();

		phase = 'loading';
		try {
			const body = { type, id };
			if (coords) {
				body.lat = coords.lat;
				body.lng = coords.lng;
			}

			const res = await fetch('/api/scan-action', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`
				},
				body: JSON.stringify(body)
			});

			if (!res.ok) {
				const text = await res.text();
				let msg = text;
				try { msg = JSON.parse(text)?.message ?? text; } catch { /* ignore */ }
				phase = 'error';
				errorMsg = msg || '処理に失敗しました';
				return;
			}

			resultData = await res.json();
			phase = 'success';
		} catch (e) {
			phase = 'error';
			errorMsg = '処理に失敗しました: ' + e.message;
		}
	}

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
					let spaceId = null;
					let yataiId = null;
					try {
						const url = new URL(text);
						spaceId = url.searchParams.get('space');
						yataiId = url.searchParams.get('yatai');
					} catch {
						spaceId = text.trim() || null;
					}
					if (yataiId) {
						await processTarget('yatai', yataiId);
					} else if (spaceId) {
						await processTarget('space', spaceId);
					} else {
						phase = 'error';
						errorMsg = '無効なQRコードです。スペースまたは屋台のQRコードを読み取ってください。';
					}
				},
				() => {}
			);
		} catch {
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

	async function retry() {
		errorMsg = '';
		resultData = null;
		await startCamera();
	}
</script>

<div class="scan-page">
	{#if phase === 'init' || phase === 'loading'}
		<div class="status-box">
			<div class="spinner"></div>
			<p>{phase === 'loading' ? '処理中…' : '準備中…'}</p>
		</div>

	{:else if phase === 'gps'}
		<div class="status-box">
			<div class="spinner"></div>
			<p>現在地を確認中…</p>
			<p class="hint">位置情報の許可ダイアログが表示された場合は「許可」を選択してください</p>
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
			{#if resultData?.action === 'checkin'}
				<h2 class="result-title">借り出し開始！</h2>
				<p class="place-name">{resultData.name}</p>
				<p class="result-note">マップ上で「出店中」として表示されます</p>
			{:else}
				<h2 class="result-title">返却完了！</h2>
				<p class="place-name">{resultData?.name}</p>
				<p class="result-note">ご利用ありがとうございました</p>
			{/if}
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
		background: var(--surface-sunk);
		padding: 20px;
	}

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

	.hint {
		font-size: 0.8rem;
		color: var(--ink-3);
		line-height: 1.5;
		margin: 0;
	}

	.spinner {
		width: 48px;
		height: 48px;
		border: 4px solid var(--line);
		border-top-color: var(--ink);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

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
		color: var(--ink);
		margin: 0;
	}

	.scan-hint {
		font-size: 0.85rem;
		color: var(--ink-2);
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

	:global(#qr-reader video) { border-radius: 12px; }
	:global(#qr-reader__scan_region) { background: transparent !important; }

	.back-btn {
		margin-top: 8px;
		background: none;
		border: none;
		color: var(--ink-2);
		font-size: 0.9rem;
		cursor: pointer;
		padding: 8px 16px;
	}

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

	.success-icon { background: #e8f5e9; color: #2e7d32; }
	.error-icon { background: #fdecea; color: var(--accent-deep); }

	.result-title {
		font-size: 1.3rem;
		font-weight: 700;
		color: var(--ink);
		margin: 0;
	}

	.place-name {
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--ink);
		margin: 0;
	}

	.result-note {
		font-size: 0.8rem;
		color: var(--ink-3);
		margin: 0;
	}

	.error-msg {
		font-size: 0.9rem;
		color: var(--accent-deep);
		text-align: center;
		margin: 0;
		line-height: 1.5;
	}

	.action-btn {
		width: 100%;
		padding: 12px;
		border-radius: 10px;
		border: none;
		background: var(--ink);
		color: #fff;
		font-size: 0.95rem;
		font-family: inherit;
		cursor: pointer;
	}

	.action-btn.retry { background: var(--accent-deep); }
	.action-btn.ghost {
		background: none;
		border: 1.5px solid var(--ink);
		color: var(--ink);
	}
</style>
