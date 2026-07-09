<!-- 認証完了後のオンボーディング（基本情報＋任意設定を一括で） -->
<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';
	import { createUserProfile, createOperatorProfile, getMyProfile } from '$lib/db.js';

	let userId = $state('');
	let isLoading = $state(true);
	let isSaving = $state(false);
	let errorMessage = $state('');

	// 基本情報（必須）
	let name = $state('');
	let phone = $state('');

	// 任意: 屋台営業アカウント
	let wantOperator = $state(false);
	let businessName = $state('');

	// 任意: 夜行人ネットワーク（図鑑）
	let wantYakonin = $state(false);
	let handle = $state('');

	onMount(async () => {
		const { data } = await supabase.auth.getSession();
		if (!data.session) { goto(`${base}/auth`); return; }
		userId = data.session.user.id;

		// すでにプロフィールがあれば設定済みなのでマイページへ
		const profile = await getMyProfile(userId);
		if (profile) { goto(`${base}/mypage`); return; }
		isLoading = false;
	});

	function validPhone(v) {
		// 日本の電話番号を緩めに判定（数字10〜11桁、ハイフン許容）
		const digits = v.replace(/[-\s]/g, '');
		return /^0\d{9,10}$/.test(digits);
	}

	async function finish(skipOptional) {
		errorMessage = '';
		if (!name.trim()) { errorMessage = 'お名前（表示名）を入力してください'; return; }
		if (!phone.trim() || !validPhone(phone)) { errorMessage = '正しい電話番号を入力してください（例: 090-1234-5678）'; return; }

		const doOperator = !skipOptional && wantOperator;
		const doYakonin  = !skipOptional && wantYakonin;
		if (doOperator && !businessName.trim()) { errorMessage = '屋号を入力してください'; return; }
		if (doYakonin && !handle.trim()) { errorMessage = 'ニックネームを入力してください'; return; }

		isSaving = true;
		try {
			// 1) 基本プロフィール（お名前＋電話番号）
			await createUserProfile(userId, '購入者', name.trim(), phone.trim());

			// 2) 任意: 屋台営業アカウント
			if (doOperator) {
				await createOperatorProfile(userId, { businessName: businessName.trim(), phoneNumber: phone.trim() });
			}

			// 3) 任意: 夜行人図鑑プロフィール
			if (doYakonin) {
				await supabase.from('yakonin_profiles').upsert(
					{ user_id: userId, handle: handle.trim(), is_public: true, updated_at: new Date().toISOString() },
					{ onConflict: 'user_id' }
				);
			}

			goto(`${base}/mypage`);
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
		<h1 class="title">続けて、各種設定を行いましょう</h1>
		<p class="subtitle">お名前と電話番号を登録すれば準備完了です。<br />屋台営業・夜行人ネットワークはあとからでも設定できます。</p>

		{#if isLoading}
			<p class="muted">読み込み中…</p>
		{:else}
			{#if errorMessage}<p class="error-msg">{errorMessage}</p>{/if}

			<!-- 基本情報 -->
			<div class="section">
				<span class="section-label">基本情報 <span class="req">必須</span></span>
				<label class="field-label">
					お名前 / 表示名
					<input type="text" bind:value={name} class="field-input" placeholder="山田 太郎" />
				</label>
				<label class="field-label">
					電話番号
					<input type="tel" bind:value={phone} class="field-input" placeholder="090-1234-5678" inputmode="tel" />
					<span class="field-note">ご本人確認・緊急連絡に使用します。公開されません。</span>
				</label>
			</div>

			<!-- 任意: 屋台営業 -->
			<div class="opt-card" class:on={wantOperator}>
				<label class="opt-head">
					<input type="checkbox" bind:checked={wantOperator} />
					<span>
						<strong>屋台を営業する</strong>
						<small>屋号を登録して、屋台のレンタル・出店ができます</small>
					</span>
				</label>
				{#if wantOperator}
					<label class="field-label nested">
						屋号
						<input type="text" bind:value={businessName} class="field-input" placeholder="例: 微小夜行電灯" />
					</label>
				{/if}
			</div>

			<!-- 任意: 夜行人ネットワーク -->
			<div class="opt-card" class:on={wantYakonin}>
				<label class="opt-head">
					<input type="checkbox" bind:checked={wantYakonin} />
					<span>
						<strong>夜行人ネットワークに参加する</strong>
						<small>3Dネットワーク（図鑑）に載せるニックネームを設定します</small>
					</span>
				</label>
				{#if wantYakonin}
					<label class="field-label nested">
						ニックネーム
						<input type="text" bind:value={handle} class="field-input" maxlength="20" placeholder="例: タオ" />
					</label>
				{/if}
			</div>

			<button class="primary-btn" onclick={() => finish(false)} disabled={isSaving}>
				{isSaving ? '設定中…' : '設定して始める →'}
			</button>
			<button class="skip-btn" onclick={() => finish(true)} disabled={isSaving}>
				基本設定だけで始める（あとで設定する）
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

	.section { text-align: left; margin-bottom: 18px; }
	.section-label {
		display: block; font-size: 0.72rem; font-weight: 600;
		letter-spacing: 0.08em; color: var(--ink-3);
		text-transform: uppercase; margin-bottom: 10px;
	}
	.req { color: var(--accent); font-size: 0.62rem; margin-left: 4px; letter-spacing: 0; }

	.field-label {
		display: block; text-align: left;
		font-size: 0.85rem; font-weight: 500; color: var(--ink-2);
		margin-bottom: 14px;
	}
	.field-label.nested { margin: 12px 0 2px; }
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

	.opt-card {
		text-align: left;
		border: 1px solid var(--line);
		border-radius: var(--r-lg);
		padding: 14px 16px;
		margin-bottom: 12px;
		background: var(--paper);
		transition: border-color 0.15s, background 0.15s;
	}
	.opt-card.on { border-color: var(--accent); background: var(--accent-tint); }
	.opt-head {
		display: flex; align-items: flex-start; gap: 10px; cursor: pointer;
	}
	.opt-head input[type="checkbox"] {
		margin-top: 2px; width: 18px; height: 18px; flex-shrink: 0; accent-color: var(--accent); cursor: pointer;
	}
	.opt-head strong { display: block; font-size: 0.9rem; color: var(--ink); }
	.opt-head small { display: block; font-size: 0.75rem; color: var(--ink-2); margin-top: 2px; line-height: 1.4; }

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

	.skip-btn {
		width: 100%; margin-top: 10px; padding: 8px;
		background: none; border: none; color: var(--ink-2);
		font-size: 0.85rem; font-family: inherit; cursor: pointer;
		text-decoration: underline; text-decoration-color: var(--line-strong);
		text-underline-offset: 3px;
	}
	.skip-btn:hover:not(:disabled) { color: var(--accent); text-decoration-color: var(--accent); }
	.skip-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
