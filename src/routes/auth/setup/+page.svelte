<!-- 認証完了後のオンボーディング：夜行人ネットワーク登録（ユーザー名・一言・アイコン）を最短で -->
<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';
	import { createUserProfile, updateUserProfile, uploadImage, getMyProfile } from '$lib/db.js';

	let userId = $state('');
	let isLoading = $state(true);
	let isSaving = $state(false);
	let errorMessage = $state('');

	// 夜行人ネットワーク登録フォーム（最短3項目）
	let username = $state('');   // 表示名＝図鑑のニックネーム
	let oneLiner = $state('');   // 一言コメント（任意）
	let iconFile = $state(null); // アイコン画像（任意）
	let iconPreview = $state('');

	onMount(async () => {
		const { data } = await supabase.auth.getSession();
		if (!data.session) { goto(`${base}/auth`); return; }
		userId = data.session.user.id;

		// すでにプロフィールがあれば設定済みなのでマイページへ
		const profile = await getMyProfile(userId);
		if (profile) { goto(`${base}/mypage/dashboard`); return; }
		isLoading = false;
	});

	function onIconChange(e) {
		const file = e.target.files?.[0];
		if (!file) return;
		iconFile = file;
		iconPreview = URL.createObjectURL(file);
	}

	async function finish() {
		errorMessage = '';
		if (!username.trim()) { errorMessage = 'ユーザー名を入力してください'; return; }

		isSaving = true;
		try {
			// 1) 基本プロフィール（表示名）
			await createUserProfile(userId, '購入者', username.trim());

			// 2) アイコン（任意）
			let iconPath = null;
			if (iconFile) {
				iconPath = await uploadImage(userId, iconFile, 'profile-images');
				await updateUserProfile(userId, { iconPath });
			}

			// 3) 夜行人ネットワーク（図鑑）に公開登録
			await supabase.from('yakonin_profiles').upsert(
				{
					user_id: userId,
					handle: username.trim(),
					one_liner: oneLiner.trim() || null,
					avatar_path: iconPath,
					is_public: true,
					updated_at: new Date().toISOString()
				},
				{ onConflict: 'user_id' }
			);

			goto(`${base}/mypage/dashboard`);
		} catch (e) {
			errorMessage = `設定に失敗しました: ${e.message}`;
			isSaving = false;
		}
	}
</script>

<svelte:head><title>初期設定 | 微小夜行電灯</title></svelte:head>

<div class="onboard-page">
	<div class="onboard-card">
		<img src="{base}/images/icon.png" alt="微小夜行電灯" class="logo-img" />
		<div class="verified"><span class="check">✓</span> メール認証が完了しました</div>
		<h1 class="title">夜行人ネットワークに登録しましょう</h1>
		<p class="subtitle">QRコードで人とつながる図鑑に載ります。<br />屋台の営業やオンラインストアは、あとからマイページで設定できます。</p>

		{#if isLoading}
			<p class="muted">読み込み中…</p>
		{:else}
			{#if errorMessage}<p class="error-msg">{errorMessage}</p>{/if}

			<!-- アイコン（任意） -->
			<div class="icon-section">
				<label class="icon-label" for="setup-icon">
					{#if iconPreview}
						<img src={iconPreview} alt="アイコン" class="icon-preview" />
					{:else}
						<span class="icon-placeholder">
							<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
						</span>
					{/if}
					<span class="icon-edit">タップして設定</span>
				</label>
				<input id="setup-icon" type="file" accept="image/*" class="hidden-file" onchange={onIconChange} />
			</div>

			<!-- ユーザー名（必須） -->
			<label class="field-label">
				ユーザー名 <span class="req">必須</span>
				<input type="text" bind:value={username} class="field-input" maxlength="20" placeholder="例: ヤタイ タロウ" />
				<span class="field-note">夜行人ネットワークに表示される名前です。</span>
			</label>

			<!-- 一言コメント（任意） -->
			<label class="field-label">
				一言コメント
				<input type="text" bind:value={oneLiner} class="field-input" maxlength="40" placeholder="例: 鴨川でコーヒー屋台やってます" />
			</label>

			<button class="primary-btn" onclick={finish} disabled={isSaving}>
				{isSaving ? '登録中…' : '登録して始める →'}
			</button>
		{/if}
	</div>
</div>

<style>
	.onboard-page {
		min-height: 80vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px 16px;
		background: var(--paper);
	}
	.onboard-card {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 20px;
		padding: 36px 28px 30px;
		width: 100%;
		max-width: 440px;
		box-shadow: var(--shadow-2);
		text-align: center;
	}
	.logo-img { width: 56px; height: 56px; object-fit: contain; margin: 0 auto 12px; display: block; }
	.verified {
		display: inline-flex; align-items: center; gap: 6px;
		font-size: 0.82rem; font-weight: 600; color: #4a6a3a;
		background: rgba(95, 122, 82, 0.12); border: 1px solid rgba(95, 122, 82, 0.28);
		padding: 5px 12px; border-radius: 100px; margin-bottom: 14px;
	}
	.verified .check {
		width: 16px; height: 16px; border-radius: 50%;
		background: #5f7a52; color: #fff; font-size: 0.7rem;
		display: inline-flex; align-items: center; justify-content: center;
	}
	.title {
		font-family: "Zen Antique", serif;
		font-size: 1.25rem; letter-spacing: 0.03em; color: var(--ink);
		margin: 0 0 8px; line-height: 1.45;
	}
	.subtitle { font-size: 0.84rem; color: var(--ink-2); line-height: 1.7; margin: 0 0 24px; }
	.muted { color: var(--ink-3); font-size: 0.9rem; }

	.error-msg {
		background: rgba(184, 92, 43, 0.08);
		color: var(--accent-deep);
		border-left: 3px solid var(--accent);
		border-radius: var(--r-sm);
		padding: 11px 12px; font-size: 0.85rem;
		margin-bottom: 16px; text-align: left;
	}

	/* アイコン */
	.icon-section { display: flex; justify-content: center; margin-bottom: 22px; }
	.icon-label {
		display: inline-flex; flex-direction: column; align-items: center; gap: 8px;
		cursor: pointer;
	}
	.icon-preview {
		width: 88px; height: 88px; border-radius: 50%; object-fit: cover;
		border: 2px solid var(--accent);
	}
	.icon-placeholder {
		width: 88px; height: 88px; border-radius: 50%;
		background: var(--surface-sunk); border: 2px dashed var(--line-strong);
		color: var(--ink-3);
		display: flex; align-items: center; justify-content: center;
	}
	.icon-edit { font-size: 0.74rem; color: var(--ink-2); }
	.hidden-file { display: none; }

	.field-label {
		display: block; text-align: left;
		font-size: 0.85rem; font-weight: 500; color: var(--ink-2);
		margin-bottom: 16px;
	}
	.req { color: var(--accent); font-size: 0.62rem; margin-left: 4px; letter-spacing: 0; }
	.field-input {
		display: block; width: 100%; margin-top: 6px;
		padding: 11px 13px; border: 1px solid var(--line-strong);
		border-radius: var(--r-md); font-size: 0.95rem; font-family: inherit;
		box-sizing: border-box; background: var(--surface); color: var(--ink);
		transition: border-color 0.15s, box-shadow 0.15s;
	}
	.field-input:focus {
		outline: none; border-color: var(--accent);
		box-shadow: 0 0 0 3px rgba(184, 92, 43, 0.1);
	}
	.field-input::placeholder { color: var(--ink-3); }
	.field-note { display: block; font-size: 0.72rem; color: var(--ink-3); margin-top: 5px; font-weight: 400; }

	.primary-btn {
		width: 100%; margin-top: 8px; padding: 13px;
		background: var(--accent); color: #fff; border: none;
		border-radius: var(--r-md); font-size: 0.98rem; font-weight: 600;
		font-family: inherit; letter-spacing: 0.02em; cursor: pointer;
		box-shadow: 0 2px 10px rgba(184, 92, 43, 0.25);
		transition: background 0.15s, transform 0.1s;
	}
	.primary-btn:hover:not(:disabled) { background: var(--accent-deep); }
	.primary-btn:active:not(:disabled) { transform: translateY(1px); }
	.primary-btn:disabled { opacity: 0.6; cursor: not-allowed; box-shadow: none; }
</style>
