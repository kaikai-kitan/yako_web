<!-- 夜行人プロフィール作成・編集（ネットワークへのオプトイン） -->
<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';
	import { uploadImage } from '$lib/db.js';

	let currentUser = $state(null);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let saveError = $state('');
	let saved = $state(false);

	// フォーム（個人情報は入れない。ニックネーム・肩書き・一言のみ）
	let handle = $state('');
	let originalHandle = '';        // 読み込み時のニックネーム（変更検知用）
	let handleLocked = $state(false); // 一度変更したら以降ロック
	let status = $state('');
	let oneLiner = $state('');
	let avatarPath = $state('');
	let isPublic = $state(true);

	// アイコン画像（ファイル選択→アップロード）
	let avatarFile = null;
	let avatarPreview = $state('');

	function onAvatarChange(e) {
		const file = e.target.files?.[0];
		if (!file) return;
		avatarFile = file;
		avatarPreview = URL.createObjectURL(file);
	}

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
			originalHandle = handle;
			handleLocked = data.handle_locked ?? false;
			status      = data.status ?? '';
			oneLiner    = data.one_liner ?? '';
			avatarPath  = data.avatar_path ?? '';
			avatarPreview = avatarPath.startsWith('http') || avatarPath.startsWith('/')
				? (avatarPath.startsWith('http') ? avatarPath : base + avatarPath)
				: '';
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
		// 既にロック済みなら名前は元に戻す（変更させない）
		if (handleLocked) handle = originalHandle;
		isSaving = true;
		saveError = '';
		saved = false;

		// 既存の名前を変更した場合、この1回で以降ロックする
		const isHandleChange = originalHandle !== '' && handle.trim() !== originalHandle;
		const nextLocked = handleLocked || isHandleChange;

		// 新しい写真が選ばれていればアップロード
		if (avatarFile) {
			try {
				avatarPath = await uploadImage(currentUser.id, avatarFile, 'profile-images');
				avatarFile = null;
			} catch (e) {
				saveError = '画像のアップロードに失敗しました: ' + e.message;
				isSaving = false;
				return;
			}
		}

		const payload = {
			user_id:     currentUser.id,
			handle:      handle.trim(),
			status:      status.trim(),
			one_liner:   oneLiner.trim(),
			avatar_path: avatarPath.trim(),
			is_public:   isPublic,
			handle_locked: nextLocked,
			updated_at:  new Date().toISOString()
		};

		let { error } = await supabase
			.from('yakonin_profiles')
			.upsert(payload, { onConflict: 'user_id' });

		// handle_locked カラム未追加（migration 未適用）の環境でも動くようフォールバック
		if (error && (error.code === '42703' || /handle_locked/.test(error.message ?? ''))) {
			delete payload.handle_locked;
			({ error } = await supabase
				.from('yakonin_profiles')
				.upsert(payload, { onConflict: 'user_id' }));
		}

		if (error) {
			saveError = '保存に失敗しました: ' + error.message;
			isSaving = false;
			return;
		}

		// 保存成功: ロック状態と基準名を更新
		originalHandle = handle.trim();
		handleLocked = nextLocked;

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
		3Dネットワーク用アカウント設定　<span class="edit-note">※名前の変更は1度までです。</span>
	</p>

	{#if isLoading}
		<p class="muted">読み込み中…</p>
	{:else}
		<div class="form">
			<label class="field">
				<span class="label">ニックネーム <span class="req">必須</span></span>
				<input type="text" bind:value={handle} maxlength="20" placeholder="例：タオ"
					disabled={handleLocked} />
				{#if handleLocked}
					<span class="field-note">名前は変更済みのため、これ以上変更できません。</span>
				{:else if originalHandle}
					<span class="field-note">名前の変更はあと1回できます。</span>
				{/if}
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

			<div class="field">
				<span class="label">アイコン写真（任意）</span>
				<label class="avatar-pick" for="avatar-file">
					{#if avatarPreview}
						<img src={avatarPreview} alt="アイコンプレビュー" class="avatar-preview" />
						<span class="avatar-hint">タップして変更</span>
					{:else}
						<span class="avatar-empty">＋ 写真を選ぶ</span>
					{/if}
				</label>
				<input id="avatar-file" type="file" accept="image/*" class="hidden-file" onchange={onAvatarChange} />
			</div>

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
	.title { text-align: center; color: var(--ink); margin-bottom: 0.8rem; }
	.lead { text-align: center; color: #4a3f38; line-height: 1.7; font-size: 0.9rem; margin-bottom: 1.8rem; }
	.edit-note { display: inline-block; margin-top: 8px; font-size: 0.8rem; color: #8a5a12; background: #fff7ed; padding: 6px 12px; border-radius: 8px; }
	.muted { color: var(--ink-3); font-size: 0.85rem; text-align: center; }

	.form { display: flex; flex-direction: column; gap: 16px; }
	.field { display: flex; flex-direction: column; gap: 6px; }
	.label { font-size: 0.82rem; font-weight: 600; color: #5a4f45; }
	.req { color: var(--accent); font-size: 0.72rem; margin-left: 4px; }
	.field-note { font-size: 0.74rem; color: var(--ink-3); }
	input[type="text"], textarea {
		border: 1px solid #ded3c4; border-radius: 10px; padding: 11px 13px;
		font-size: 0.95rem; font-family: inherit; background: #fff; color: var(--ink);
		box-sizing: border-box; width: 100%;
	}
	input:focus, textarea:focus { outline: none; border-color: var(--accent); }
	input:disabled { background: var(--surface-sunk); color: var(--ink-2); cursor: not-allowed; }
	textarea { resize: vertical; }

	.hidden-file { display: none; }
	.avatar-pick {
		display: flex; flex-direction: column; align-items: center; gap: 8px;
		cursor: pointer; border: 1px dashed var(--line-strong); border-radius: 14px;
		padding: 18px; background: var(--surface); transition: border-color 0.15s;
	}
	.avatar-pick:hover { border-color: var(--accent); }
	.avatar-preview { width: 96px; height: 96px; border-radius: 50%; object-fit: cover; border: 1px solid var(--line); }
	.avatar-hint, .avatar-empty { font-size: 0.8rem; color: var(--ink-3); letter-spacing: 0.04em; }

	.toggle { display: flex; align-items: flex-start; gap: 10px; font-size: 0.82rem; color: #4a3f38; line-height: 1.5; }
	.toggle input { margin-top: 2px; flex-shrink: 0; }

	.err { color: var(--accent-deep); font-size: 0.85rem; margin: 0; }
	.ok { color: #2e7d32; font-size: 0.85rem; margin: 0; }

	.save-btn {
		margin-top: 6px; padding: 13px; border: none; border-radius: 12px;
		background: var(--accent); color: #fff; font-size: 0.95rem; font-weight: 700;
		cursor: pointer; transition: background 0.15s;
	}
	.save-btn:hover:not(:disabled) { background: #b85d03; }
	.save-btn:disabled { opacity: 0.6; cursor: default; }

	.qr-box {
		margin-top: 2.4rem; padding: 20px; border: 1px solid #ede4d5;
		border-radius: 16px; background: #fffdf9; text-align: center;
	}
	.qr-title { font-size: 1rem; color: var(--ink); margin-bottom: 0.4rem; }
	.qr-img { width: 220px; height: 220px; margin-top: 12px; }
	.url-row { display: flex; gap: 8px; margin: 14px auto 0; max-width: 320px; }
	.url-row input { flex: 1; border: 1px solid #ded3c4; border-radius: 8px; padding: 8px 10px; font-size: 0.72rem; color: #5a4f45; background: var(--surface-sunk); }
	.url-row button { border: none; background: var(--ink); color: #fff; border-radius: 8px; padding: 0 14px; font-size: 0.78rem; font-weight: 700; cursor: pointer; }
	.nfc-hint { font-size: 0.76rem; color: #6b5f54; line-height: 1.6; margin: 12px 0 0; }
</style>
