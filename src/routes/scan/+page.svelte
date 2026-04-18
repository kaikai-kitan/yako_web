<script>
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';

	let userId = $state('');
	/** @type {'init'|'scanning'|'loading'|'success'|'error'} */
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

		const params = new URLSearchParams(window.location.search);
		const spaceId = params.get('space');
		const rentalDoneId = params.get('rental_done');
		const stripeSessionId = params.get('session_id');

		if (rentalDoneId && stripeSessionId) {
			// Stripe決済完了後の返却 → 予約をアクティブ化
			await activateFromStripe(rentalDoneId, stripeSessionId);
		} else if (spaceId) {
			// QRコードから直接アクセス → Stripe決済へ
			await startPayment(spaceId);
		} else {
			// パラメータなし → カメラスキャン
			await startCamera();
		}
	});

	onDestroy(() => {
		stopCamera();
	});

	/** QRコードからスペースIDを読み取り、Stripe決済へ進む */
	async function startPayment(spaceId) {
		phase = 'loading';
		try {
			// このスペースに対するpending予約を取得
			const { data: reservation } = await supabase
				.from('reservations')
				.select('id, start_datetime, end_datetime, planned_items, stall_specs(stall_name), rental_spaces(name)')
				.eq('user_id', userId)
				.eq('rental_space_id', spaceId)
				.eq('status', 'pending')
				.order('start_datetime', { ascending: true })
				.limit(1)
				.maybeSingle();

			if (!reservation) {
				phase = 'error';
				errorMsg = 'この場所の有効な予約が見つかりません。予約状況をご確認ください。';
				return;
			}

			const origin = window.location.origin;
			const res = await fetch('/api/create-rental-checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					reservationId: reservation.id,
					userId,
					successUrl: `${origin}/scan?space=${spaceId}&rental_done=${reservation.id}&session_id={CHECKOUT_SESSION_ID}`,
					cancelUrl: `${origin}/map`
				})
			});

			if (!res.ok) {
				const msg = await res.text();
				phase = 'error';
				errorMsg = `決済処理に失敗しました: ${msg}`;
				return;
			}

			const { url, free } = await res.json();

			if (free) {
				// 無料の場合はそのまま成功
				successData = reservation;
				phase = 'success';
			} else {
				// Stripe決済ページへリダイレクト
				window.location.href = url;
			}
		} catch (e) {
			phase = 'error';
			errorMsg = '処理に失敗しました: ' + e.message;
		}
	}

	/** Stripe決済完了後に予約をアクティブ化 */
	async function activateFromStripe(reservationId, stripeSessionId) {
		phase = 'loading';
		window.history.replaceState({}, '', '/scan');
		try {
			const res = await fetch('/api/activate-rental', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId: stripeSessionId,
					reservationId,
					userId
				})
			});

			if (res.ok) {
				const { data } = await supabase
					.from('reservations')
					.select('rental_spaces(name), stall_specs(stall_name)')
					.eq('id', reservationId)
					.single();
				successData = data;
				phase = 'success';
			} else {
				const msg = await res.text();
				phase = 'error';
				errorMsg = `決済の確認に失敗しました: ${msg}`;
			}
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
					// URLからspaceパラメータを抽出
					let spaceId = text.trim();
					try {
						const url = new URL(text);
						spaceId = url.searchParams.get('space') ?? text.trim();
					} catch {
						// URLでない場合はそのままspaceIdとして扱う
					}
					await startPayment(spaceId);
				},
				() => {}
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

	async function retry() {
		errorMsg = '';
		await startCamera();
	}
</script>

<div class="scan-page">
	{#if phase === 'init' || phase === 'loading'}
		<div class="status-box">
			<div class="spinner"></div>
			<p>{phase === 'loading' ? '処理中…' : '準備中…'}</p>
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

	:global(#qr-reader video) { border-radius: 12px; }
	:global(#qr-reader__scan_region) { background: transparent !important; }

	.back-btn {
		margin-top: 8px;
		background: none;
		border: none;
		color: #7a6f67;
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
	.error-icon { background: #fdecea; color: #c62828; }

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

	.action-btn.retry { background: #c62828; }
	.action-btn.ghost {
		background: none;
		border: 1.5px solid #26201a;
		color: #26201a;
	}
</style>
