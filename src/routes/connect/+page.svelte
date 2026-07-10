<!-- NFC / QR の着地点：屋台または人とつながる -->
<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';
	import Icon from '$lib/components/Icon.svelte';

	/** @type {'loading'|'confirm'|'connecting'|'done'|'error'} */
	let phase = $state('loading');
	let errorMsg = $state('');

	let accessToken = '';
	let stallId = '';
	let connectCode = '';
	let targetName = $state('');   // 表示用（屋台名 or 相手のハンドル）
	let targetKind = $state('');   // 'stall' | 'person'
	let resultMsg = $state('');

	const CONFIRM_KEY = 'yakonin_connect_confirmed';

	onMount(async () => {
		const params = new URLSearchParams(window.location.search);
		stallId     = params.get('stall') ?? '';
		connectCode = params.get('u') ?? '';

		if (!stallId && !connectCode) {
			phase = 'error';
			errorMsg = '無効なリンクです。屋台のQR/NFC、または相手の接続QRを読み取ってください。';
			return;
		}

		// 1) ログイン必須
		const here = `${base}/connect${window.location.search}`;
		const { data: { session } } = await supabase.auth.getSession();
		if (!session) {
			goto(`${base}/auth?redirectTo=${encodeURIComponent(here)}`);
			return;
		}
		accessToken = session.access_token;

		// 2) 夜行人プロフィール必須（オプトイン）
		const { data: profile } = await supabase
			.from('yakonin_profiles')
			.select('user_id')
			.eq('user_id', session.user.id)
			.maybeSingle();
		if (!profile) {
			goto(`${base}/yakonin/setup?redirectTo=${encodeURIComponent(here)}`);
			return;
		}

		// 3) 接続先の表示名を取得
		if (stallId) {
			targetKind = 'stall';
			const { data: stall } = await supabase
				.from('stall_specs').select('stall_name').eq('id', stallId).maybeSingle();
			if (!stall) { phase = 'error'; errorMsg = '屋台が見つかりません。'; return; }
			targetName = stall.stall_name ?? '屋台';
		} else {
			targetKind = 'person';
			const { data: person } = await supabase
				.from('yakonin_profiles').select('handle').eq('connect_code', connectCode).maybeSingle();
			if (!person) { phase = 'error'; errorMsg = '相手のプロフィールが見つかりません。'; return; }
			targetName = person.handle ?? '夜行人';
		}

		// 4) 人との接続は毎回かならず確認する。屋台は初回のみ確認（以降は自動）。
		const autoOk = targetKind === 'stall' && localStorage.getItem(CONFIRM_KEY) === '1';
		if (autoOk) {
			await doConnect();
		} else {
			phase = 'confirm';
		}
	});

	async function doConnect() {
		phase = 'connecting';
		try {
			const res = await fetch('/api/network/connect', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
				body: JSON.stringify(stallId ? { stallId } : { connectCode })
			});

			if (res.status === 409) {
				const here = `${base}/connect${window.location.search}`;
				goto(`${base}/yakonin/setup?redirectTo=${encodeURIComponent(here)}`);
				return;
			}
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				phase = 'error';
				errorMsg = d.message ?? 'つながりの作成に失敗しました。';
				return;
			}

			const data = await res.json();
			localStorage.setItem(CONFIRM_KEY, '1');

			if (data.action === 'stall') {
				resultMsg = data.newCovisitors > 0
					? `「${data.stallName}」とつながりました！さらに ${data.newCovisitors} 人の夜行人とも縁ができました。`
					: `「${data.stallName}」とつながりました！`;
			} else {
				resultMsg = `${data.handle} とつながりました！`;
			}
			phase = 'done';
		} catch (e) {
			phase = 'error';
			errorMsg = '通信に失敗しました: ' + e.message;
		}
	}
</script>

<svelte:head><title>つながる | 夜行人ネットワーク</title></svelte:head>

<div class="wrap">
	{#if phase === 'loading' || phase === 'connecting'}
		<div class="card">
			<div class="spinner"></div>
			<p>{phase === 'connecting' ? 'つないでいます…' : '準備中…'}</p>
		</div>

	{:else if phase === 'confirm'}
		<div class="card">
			<div class="icon-badge">
				{#if targetKind === 'stall'}<Icon name="yatai" size={30} />{:else}<Icon name="handshake" size={30} />{/if}
			</div>
			<h1 class="q">「{targetName}」とつながりますか？</h1>
			<p class="note">
				あなたの夜行人ネットワークに追加されます。<br />
				公開されるのはニックネームと一言だけ。実名・連絡先は共有されません。
			</p>
			<button class="primary" onclick={doConnect}>つながる</button>
			<button class="ghost" onclick={() => goto(`${base}/directory`)}>やめておく</button>
		</div>

	{:else if phase === 'done'}
		<div class="card">
			<div class="icon-badge success">
				<Icon name="circle-check" size={30} />
			</div>
			<h1 class="q">つながりました！</h1>
			<p class="note">{resultMsg}</p>
			<button class="primary" onclick={() => goto(`${base}/directory`)}>ネットワークを見る</button>
		</div>

	{:else if phase === 'error'}
		<div class="card">
			<div class="icon-badge warn">
				<Icon name="alert-triangle" size={30} />
			</div>
			<h1 class="q">つながれませんでした</h1>
			<p class="note">{errorMsg}</p>
			<button class="ghost" onclick={() => goto(`${base}/directory`)}>夜行人図鑑へ</button>
		</div>
	{/if}
</div>

<style>
	.wrap {
		min-height: 80svh; display: flex; align-items: center; justify-content: center;
		padding: 24px; background: var(--surface-sunk);
	}
	.card {
		width: 100%; max-width: 360px; background: #fff; border: 1px solid #ede4d5;
		border-radius: 20px; padding: 32px 24px; text-align: center;
		display: flex; flex-direction: column; align-items: center; gap: 14px;
		box-shadow: 0 6px 24px rgba(0,0,0,0.06);
	}
	.icon-badge {
		width: 64px; height: 64px; margin: 0 auto;
		border-radius: 50%;
		display: flex; align-items: center; justify-content: center;
		background: var(--accent-tint); color: var(--accent);
	}
	.icon-badge.success { background: rgba(95, 122, 82, 0.14); color: #4a6a3a; }
	.icon-badge.warn { background: rgba(184, 92, 43, 0.1); color: var(--accent-deep); }
	.q { font-size: 1.15rem; color: var(--ink); margin: 0; line-height: 1.4; }
	.note { font-size: 0.85rem; color: #6b5f54; line-height: 1.65; margin: 0; }

	.primary, .ghost {
		width: 100%; padding: 13px; border-radius: 12px; font-size: 0.95rem;
		font-weight: 700; font-family: inherit; cursor: pointer; border: none;
	}
	.primary { background: var(--accent); color: #fff; }
	.primary:hover { background: #b85d03; }
	.ghost { background: none; border: 1.5px solid #ded3c4; color: #5a4f45; }

	.spinner {
		width: 44px; height: 44px; border: 4px solid #ece3d6; border-top-color: var(--accent);
		border-radius: 50%; animation: spin 0.8s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }
</style>
