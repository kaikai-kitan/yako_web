<!-- 夜行人プロフィール作成・編集（ネットワークへのオプトイン） -->
<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';

	let currentUser = $state(null);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let saveError = $state('');
	let saved = $state(false);

	// フォーム（個人情報は入れない。ニックネーム・肩書き・一言のみ）
	let handle = $state('');
	let status = $state('');
	let oneLiner = $state('');
	let avatarPath = $state('');
	let isPublic = $state(true);

	let connectCode = $state('');
	let connectQr = $state('');
	let connectUrl = $state('');

	// リダイレクト先（/connect から来た場合、保存後に戻す）
	let redirectTo = $state('');

	onMount(async () => {
		const { data: { session } } = await supabase.auth.getSession();
		if (!session) {
			goto(`${base}/auth?redirectTo=${encodeURIComponent(`${base}/yakonin/setup`)}`);
			return;
		}
		currentUser = session.user;

		const params = new URLSearchParams(window.location.search);
		redirectTo = params.get('redirectTo') ?? '';

		const { data } = await supabase
			.from('yakonin_profiles')
			.select('*')
			.eq('user_id', session.user.id)
			.maybeSingle();

		if (data) {
			handle      = data.handle ?? '';
			status      = data.status ?? '';
			oneLiner    = data.one_liner ?? '';
			avatarPath  = data.avatar_path ?? '';
			isPublic    = data.is_public ?? true;
			connectCode = data.connect_code ?? '';
			await renderQr();
		}
		isLoading = false;
	});

	async function renderQr() {
		if (!connectCode) return;
		connectUrl = `${window.location.origin}${base}/connect?u=${connectCode}`;
		try {
			const QRCode = (await import('qrcode')).default;
			connectQr = await QRCode.toDataURL(connectUrl, { margin: 1, width: 220 });
		} catch { /* QR 生成失敗は致命的でない */ }
	}

	async function copyConnectUrl() {
		try { await navigator.clipboard.writeText(connectUrl); } catch { /* noop */ }
	}

	async function handleSave() {
		if (!handle.trim()) { saveError = 'ニックネームを入力してください'; return; }
		isSaving = true;
		saveError = '';
		saved = false;

		const payload = {
			user_id:     currentUser.id,
			handle:      handle.trim(),
			status:      status.trim(),
			one_liner:   oneLiner.trim(),
			avatar_path: avatarPath.trim(),
			is_public:   isPublic,
			updated_at:  new Date().toISOString()
		};

		const { error } = await supabase
			.from('yakonin_profiles')
			.upsert(payload, { onConflict: 'user_id' });

		if (error) {
			saveError = '保存に失敗しました: ' + error.message;
			isSaving = false;
			return;
		}

		// connect_code は DB 側で自動生成されるので再取得
		const { data } = await supabase
			.from('yakonin_profiles')
			.select('connect_code')
			.eq('user_id', currentUser.id)
			.maybeSingle();
		connectCode = data?.connect_code ?? '';
		await renderQr();

		saved = true;
		isSaving = false;

		if (redirectTo) {
			setTimeout(() => goto(redirectTo), 700);
		}
	}
</script>

<svelte:head><title>夜行人プロフィール | 微小夜行電灯</title></svelte:head>

<main>
	<h1 class="title">夜行人プロフィール</h1>
	<p class="lead">
		夜行人ネットワークに載せる<strong>公開ペルソナ</strong>です。<br />
		実名やメールは使いません。ニックネームと一言だけでOK。<br />
		<span class="edit-note">一言・アイコンは<strong>いつでもこの画面から変更</strong>できます（マイページ →「夜行人プロフィール」）。</span>
	</p>

	{#if isLoading}
		<p class="muted">読み込み中…</p>
	{:else}
		<div class="form">
			<label class="field">
				<span class="label">ニックネーム <span class="req">必須</span></span>
				<input type="text" bind:value={handle} maxlength="20" placeholder="例：タオ" />
			</label>

			<label class="field">
				<span class="label">肩書き・社会的階級</span>
				<input type="text" bind:value={status} maxlength="30" placeholder="例：浪漫家科学教徒" />
			</label>

			<label class="field">
				<span class="label">一言・迷言</span>
				<textarea bind:value={oneLiner} maxlength="60" rows="2"
					placeholder="例：自分の人生は自分で歩め。夜は誰かと行け。"></textarea>
			</label>

			<label class="field">
				<span class="label">アイコン画像URL（任意）</span>
				<input type="text" bind:value={avatarPath} placeholder="/images/yatainin/01.png など" />
			</label>

			<label class="toggle">
				<input type="checkbox" bind:checked={isPublic} />
				<span>ネットワークに表示する（オフにすると自分の繋がりも他人から見えなくなります）</span>
			</label>

			{#if saveError}<p class="err">{saveError}</p>{/if}
			{#if saved}<p class="ok">保存しました！</p>{/if}

			<button class="save-btn" onclick={handleSave} disabled={isSaving}>
				{isSaving ? '保存中…' : 'プロフィールを保存'}
			</button>
		</div>

		{#if connectQr}
			<div class="qr-box">
				<h2 class="qr-title">あなたの接続QR</h2>
				<p class="muted">相手にこれを読み取ってもらうと、その場でつながれます（Instagram の QR のような感覚です）。</p>
				<img src={connectQr} alt="接続QRコード" class="qr-img" />
				<div class="url-row">
					<input type="text" readonly value={connectUrl} />
					<button onclick={copyConnectUrl}>コピー</button>
				</div>
				<p class="nfc-hint">
					このURLを NFC タグ（カードキー）に書き込めば、営業中にレジへ置いて<strong>タッチで繋がる</strong>使い方もできます。
				</p>
			</div>
		{/if}
	{/if}
</main>

<style>
	main { max-width: 15cm; margin: auto; padding: 2rem 16px 3rem; box-sizing: border-box; }
	.title { text-align: center; color: #26201a; margin-bottom: 0.8rem; }
	.lead { text-align: center; color: #4a3f38; line-height: 1.7; font-size: 0.9rem; margin-bottom: 1.8rem; }
	.edit-note { display: inline-block; margin-top: 8px; font-size: 0.8rem; color: #8a5a12; background: #fff7ed; padding: 6px 12px; border-radius: 8px; }
	.muted { color: #9e8f7a; font-size: 0.85rem; text-align: center; }

	.form { display: flex; flex-direction: column; gap: 16px; }
	.field { display: flex; flex-direction: column; gap: 6px; }
	.label { font-size: 0.82rem; font-weight: 600; color: #5a4f45; }
	.req { color: #d56d04; font-size: 0.72rem; margin-left: 4px; }
	input[type="text"], textarea {
		border: 1px solid #ded3c4; border-radius: 10px; padding: 11px 13px;
		font-size: 0.95rem; font-family: inherit; background: #fff; color: #26201a;
		box-sizing: border-box; width: 100%;
	}
	input:focus, textarea:focus { outline: none; border-color: #d56d04; }
	textarea { resize: vertical; }

	.toggle { display: flex; align-items: flex-start; gap: 10px; font-size: 0.82rem; color: #4a3f38; line-height: 1.5; }
	.toggle input { margin-top: 2px; flex-shrink: 0; }

	.err { color: #c0392b; font-size: 0.85rem; margin: 0; }
	.ok { color: #2e7d32; font-size: 0.85rem; margin: 0; }

	.save-btn {
		margin-top: 6px; padding: 13px; border: none; border-radius: 12px;
		background: #d56d04; color: #fff; font-size: 0.95rem; font-weight: 700;
		cursor: pointer; transition: background 0.15s;
	}
	.save-btn:hover:not(:disabled) { background: #b85d03; }
	.save-btn:disabled { opacity: 0.6; cursor: default; }

	.qr-box {
		margin-top: 2.4rem; padding: 20px; border: 1px solid #ede4d5;
		border-radius: 16px; background: #fffdf9; text-align: center;
	}
	.qr-title { font-size: 1rem; color: #26201a; margin-bottom: 0.4rem; }
	.qr-img { width: 220px; height: 220px; margin-top: 12px; }
	.url-row { display: flex; gap: 8px; margin: 14px auto 0; max-width: 320px; }
	.url-row input { flex: 1; border: 1px solid #ded3c4; border-radius: 8px; padding: 8px 10px; font-size: 0.72rem; color: #5a4f45; background: #faf8f5; }
	.url-row button { border: none; background: #26201a; color: #fff; border-radius: 8px; padding: 0 14px; font-size: 0.78rem; font-weight: 700; cursor: pointer; }
	.nfc-hint { font-size: 0.76rem; color: #6b5f54; line-height: 1.6; margin: 12px 0 0; }
</style>
