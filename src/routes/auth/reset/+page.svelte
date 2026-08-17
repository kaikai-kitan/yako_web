<!-- パスワード再設定（メールのリンクから来たユーザーが新しいパスワードを設定） -->
<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';

	let phase = $state('loading'); // 'loading' | 'ready' | 'invalid' | 'done'
	let password = $state('');
	let password2 = $state('');
	let showPw = $state(false);
	let errorMessage = $state('');
	let isSaving = $state(false);

	onMount(async () => {
		// リカバリーリンクから来ると supabase-js がURLのトークンを処理してセッションを確立する
		const { data } = await supabase.auth.getSession();
		if (data.session) { phase = 'ready'; return; }

		// URL 処理のタイミング差を考慮し、認証状態の変化を少し待つ
		const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
			if (session) phase = 'ready';
		});
		setTimeout(() => {
			if (phase === 'loading') phase = 'invalid';
			sub.subscription.unsubscribe();
		}, 2500);
	});

	async function submit() {
		errorMessage = '';
		if (password.length < 6) { errorMessage = 'パスワードは6文字以上で入力してください'; return; }
		if (password !== password2) { errorMessage = 'パスワードが一致しません'; return; }
		isSaving = true;
		try {
			const { error } = await supabase.auth.updateUser({ password });
			if (error) throw error;
			phase = 'done';
			setTimeout(() => goto(`${base}/mypage/dashboard`), 1500);
		} catch (e) {
			errorMessage = '再設定に失敗しました: ' + e.message;
			isSaving = false;
		}
	}
</script>

<svelte:head><title>パスワード再設定 | 微小夜行電灯</title></svelte:head>

<div class="reset-page">
	<div class="reset-card">
		<img src="{base}/images/icon.png" alt="微小夜行電灯" class="logo-img" />

		{#if phase === 'loading'}
			<p class="muted">確認中…</p>

		{:else if phase === 'invalid'}
			<h1 class="title">リンクが無効です</h1>
			<p class="lead">再設定リンクの有効期限が切れているか、無効です。<br />お手数ですが、もう一度お試しください。</p>
			<a href="{base}/auth" class="submit-btn link-btn">ログイン画面へ</a>

		{:else if phase === 'done'}
			<h1 class="title">再設定が完了しました</h1>
			<p class="lead">新しいパスワードでご利用いただけます。<br />マイページへ移動します…</p>

		{:else}
			<h1 class="title">新しいパスワードを設定</h1>
			<p class="lead">新しいパスワードを入力してください。</p>

			{#if errorMessage}<p class="error-msg">{errorMessage}</p>{/if}

			<form onsubmit={(e) => { e.preventDefault(); submit(); }}>
				<label class="field-label">
					新しいパスワード
					<div class="pw-wrap">
						<input type={showPw ? 'text' : 'password'} bind:value={password} class="field-input pw-input" placeholder="6文字以上" minlength="6" required />
						<button type="button" class="pw-toggle" onclick={() => (showPw = !showPw)} aria-label={showPw ? 'パスワードを隠す' : 'パスワードを表示'} aria-pressed={showPw}>
							{#if showPw}
								<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
							{:else}
								<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
							{/if}
						</button>
					</div>
				</label>
				<label class="field-label">
					新しいパスワード（確認）
					<input type={showPw ? 'text' : 'password'} bind:value={password2} class="field-input" placeholder="もう一度入力" minlength="6" required />
				</label>
				<button type="submit" class="submit-btn" disabled={isSaving}>
					{isSaving ? '設定中…' : 'パスワードを再設定する'}
				</button>
			</form>
		{/if}
	</div>
</div>

<style>
	.reset-page {
		min-height: 80vh; display: flex; align-items: center; justify-content: center;
		padding: 20px; background: var(--paper);
	}
	.reset-card {
		background: var(--surface); border: 1px solid var(--line);
		border-radius: var(--r-lg); padding: 40px 32px;
		width: 100%; max-width: 400px; box-shadow: var(--shadow-2); text-align: center;
	}
	.logo-img { width: 56px; height: 56px; object-fit: contain; margin: 0 auto 12px; display: block; }
	.title {
		font-family: "Zen Antique", serif; font-size: 1.25rem; letter-spacing: 0.04em;
		color: var(--ink); margin: 0 0 10px;
	}
	.lead { font-size: 0.86rem; color: var(--ink-2); line-height: 1.7; margin: 0 0 22px; }
	.muted { color: var(--ink-3); font-size: 0.9rem; }
	.error-msg {
		background: rgba(184, 92, 43, 0.08); color: var(--accent-deep);
		border-left: 3px solid var(--accent); border-radius: var(--r-sm);
		padding: 11px 12px; font-size: 0.85rem; margin-bottom: 16px; text-align: left;
	}
	.field-label {
		display: block; text-align: left; font-size: 0.85rem; font-weight: 500;
		color: var(--ink-2); margin-bottom: 16px;
	}
	.field-input {
		display: block; width: 100%; margin-top: 6px; padding: 11px 13px;
		border: 1px solid var(--line-strong); border-radius: var(--r-md);
		font-size: 0.95rem; font-family: inherit; box-sizing: border-box;
		background: var(--surface); color: var(--ink);
		transition: border-color 0.15s, box-shadow 0.15s;
	}
	.field-input:focus {
		outline: none; border-color: var(--accent);
		box-shadow: 0 0 0 3px rgba(184, 92, 43, 0.1);
	}
	.pw-wrap { position: relative; }
	.pw-input { padding-right: 44px; }
	.pw-toggle {
		position: absolute; top: 50%; right: 6px; transform: translateY(-50%);
		display: flex; align-items: center; justify-content: center;
		width: 34px; height: 34px; padding: 0;
		background: none; border: none; cursor: pointer;
		color: var(--ink-3); border-radius: 8px;
		transition: color 0.15s, background 0.15s;
	}
	.pw-toggle:hover { color: var(--ink-2); background: var(--surface-sunk); }
	.pw-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
	.submit-btn {
		width: 100%; padding: 12px; background: var(--accent); color: #fff;
		border: none; border-radius: var(--r-md); font-size: 0.95rem; font-weight: 600;
		font-family: inherit; letter-spacing: 0.02em; cursor: pointer; margin-top: 8px;
		box-shadow: 0 2px 10px rgba(184, 92, 43, 0.25); transition: all 0.15s ease;
		text-decoration: none; display: inline-block; box-sizing: border-box;
	}
	.submit-btn:hover:not(:disabled) { background: var(--accent-deep); transform: translateY(-1px); }
	.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
	.link-btn { display: inline-block; }
</style>
