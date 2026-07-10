<!-- ログイン / 新規登録ページ -->
<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { signIn, signUp } from '$lib/db.js';
	import { supabase, isSupabaseConfigured } from '$lib/supabase.js';

	let mode = $state('signin'); // 'signin' | 'signup' | 'reset'
	let email = $state('');
	let password = $state('');
	let agreedToTerms = $state(false);
	let errorMessage = $state('');
	let successMessage = $state('');
	let isLoading = $state(false);

	// ?redirectTo= はクライアント側でのみ読む（プリレンダリング対策）
	let redirectTo = $state(`${base}/mypage`);

	onMount(async () => {
		redirectTo = new URLSearchParams(window.location.search).get('redirectTo') ?? `${base}/mypage`;
		const { data } = await supabase.auth.getSession();
		if (data.session) {
			goto(redirectTo);
		}
	});

	async function handleSubmit() {
		errorMessage = '';
		successMessage = '';

		if (!isSupabaseConfigured) {
			errorMessage = 'Supabase が未設定です。.env ファイルに VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。';
			return;
		}

		if (mode === 'signup' && !agreedToTerms) {
			errorMessage = '利用規約・特定商取引法に基づく表記に同意してください';
			return;
		}

		isLoading = true;

		try {
			if (mode === 'signup') {
				// 確認メールのリンク先＝認証後オンボーディング（localhost へ飛ぶ事故も防ぐ）
				const emailRedirectTo = `${window.location.origin}${base}/auth/setup`;
				const { data, error } = await signUp(email, password, emailRedirectTo);
				if (error) throw error;
				// 既に登録済みのメールは Supabase が identities=[] で返す（列挙対策）
				if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
					errorMessage = 'このメールアドレスは既に使用されています。ログイン、またはパスワードの再設定をお試しください。';
					return;
				}
				if (data.user && !data.user.email_confirmed_at) {
					successMessage =
						'確認メールを送信しました。メールを確認してからログインしてください。';
				} else {
					goto(`${base}/auth/setup`);
				}
			} else {
				const { error } = await signIn(email, password);
				if (error) throw error;
				goto(redirectTo);
			}
		} catch (e) {
			const msgs = {
				'Invalid login credentials': 'メールアドレスまたはパスワードが違います',
				'User already registered': 'このメールアドレスはすでに登録されています',
				'Password should be at least 6 characters': 'パスワードは6文字以上で入力してください'
			};
			errorMessage = msgs[e.message] ?? e.message;
		} finally {
			isLoading = false;
		}
	}

	// パスワード再設定メールを送る
	async function sendReset() {
		errorMessage = '';
		successMessage = '';
		if (!email) { errorMessage = 'メールアドレスを入力してください'; return; }
		isLoading = true;
		try {
			const { error } = await supabase.auth.resetPasswordForEmail(email, {
				redirectTo: `${window.location.origin}${base}/auth/reset`
			});
			if (error) throw error;
			successMessage = 'パスワード再設定用のメールを送信しました。メール内のリンクから再設定してください。';
		} catch (e) {
			errorMessage = e.message;
		} finally {
			isLoading = false;
		}
	}

	function switchMode(m) {
		mode = m;
		errorMessage = '';
		successMessage = '';
	}
</script>

<div class="auth-page">
	<div class="auth-card">
		<img src="{base}/images/icon.png" alt="微小夜行電灯" class="logo-img" />
		<h1 class="title">微小夜行電灯</h1>

		<!-- タブ切り替え（リセット時は非表示） -->
		{#if mode !== 'reset'}
			<div class="tab-group">
				<button class="tab" class:active={mode === 'signin'} onclick={() => switchMode('signin')}>
					ログイン
				</button>
				<button class="tab" class:active={mode === 'signup'} onclick={() => switchMode('signup')}>
					新規登録
				</button>
			</div>
		{:else}
			<p class="reset-title">パスワードの再設定</p>
			<p class="reset-lead">ご登録のメールアドレスに、再設定用のリンクをお送りします。</p>
		{/if}

		{#if errorMessage}
			<p class="error-msg">{errorMessage}</p>
		{/if}
		{#if successMessage}
			<p class="success-msg">{successMessage}</p>
		{/if}

		<form onsubmit={(e) => { e.preventDefault(); mode === 'reset' ? sendReset() : handleSubmit(); }}>
			<label class="field-label">
				メールアドレス
				<input
					type="email"
					bind:value={email}
					class="field-input"
					placeholder="example@mail.com"
					required
				/>
			</label>

			{#if mode !== 'reset'}
				<label class="field-label">
					パスワード
					<input
						type="password"
						bind:value={password}
						class="field-input"
						placeholder="6文字以上"
						minlength="6"
						required
					/>
				</label>
			{/if}

			{#if mode === 'signin'}
				<button type="button" class="forgot-link" onclick={() => switchMode('reset')}>
					パスワードをお忘れですか？
				</button>
			{/if}

			{#if mode === 'signup'}
				<label class="terms-check">
					<input type="checkbox" bind:checked={agreedToTerms} />
					<span>
						<a href="/terms" target="_blank" rel="noopener">利用規約</a>および
						<a href="/tokusho" target="_blank" rel="noopener">特定商取引法に基づく表記</a>に同意する
					</span>
				</label>
			{/if}

			<button type="submit" class="submit-btn" disabled={isLoading || (mode === 'signup' && !agreedToTerms)}>
				{#if isLoading}
					処理中…
				{:else if mode === 'signup'}
					新規登録
				{:else if mode === 'reset'}
					再設定メールを送る
				{:else}
					ログイン
				{/if}
			</button>
		</form>

		{#if mode === 'reset'}
			<button type="button" class="back-to-login" onclick={() => switchMode('signin')}>← ログインに戻る</button>
		{:else}
			<div class="divider">
				<span>または</span>
			</div>
			<a href="{base}/map" class="guest-link">登録なしでマップを見る →</a>
		{/if}
	</div>
</div>

<style>
	.auth-page {
		min-height: 80vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		background: var(--paper);
	}

	.auth-card {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--r-lg);
		padding: 40px 32px;
		width: 100%;
		max-width: 400px;
		box-shadow: var(--shadow-2);
		text-align: center;
	}

	.logo-img {
		width: 64px;
		height: 64px;
		object-fit: contain;
		margin: 0 auto 10px;
		display: block;
	}

	.title {
		font-family: "Zen Antique", serif;
		font-size: 1.4rem;
		letter-spacing: 0.06em;
		color: var(--ink);
		margin: 0 0 28px;
	}

	.tab-group {
		display: flex;
		gap: 4px;
		background: var(--surface-sunk);
		border-radius: var(--r-md);
		padding: 4px;
		margin-bottom: 24px;
		border: 1px solid var(--line);
	}

	.tab {
		flex: 1;
		padding: 9px;
		border: none;
		background: transparent;
		border-radius: var(--r-sm);
		font-size: 0.9rem;
		color: var(--ink-2);
		cursor: pointer;
		transition: all 0.15s;
		font-weight: 500;
	}

	.tab.active {
		background: var(--surface);
		color: var(--accent);
		box-shadow: var(--shadow-1);
		border: 1px solid var(--line);
	}

	.error-msg {
		background: rgba(184, 92, 43, 0.08);
		color: var(--accent-deep);
		border-left: 3px solid var(--accent);
		border-radius: var(--r-sm);
		padding: 11px 12px;
		font-size: 0.85rem;
		margin-bottom: 16px;
		text-align: left;
	}

	.success-msg {
		background: rgba(95, 122, 82, 0.08);
		color: #4a6a3a;
		border-left: 3px solid #5f7a52;
		border-radius: var(--r-sm);
		padding: 11px 12px;
		font-size: 0.85rem;
		margin-bottom: 16px;
		text-align: left;
	}

	.field-label {
		display: block;
		text-align: left;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--ink-2);
		margin-bottom: 16px;
	}

	.field-input {
		display: block;
		width: 100%;
		margin-top: 6px;
		padding: 11px 13px;
		border: 1px solid var(--line-strong);
		border-radius: var(--r-md);
		font-size: 0.95rem;
		font-family: inherit;
		box-sizing: border-box;
		background: var(--surface);
		color: var(--ink);
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.field-input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px rgba(184, 92, 43, 0.1);
	}

	.field-input::placeholder {
		color: var(--ink-3);
	}

	.terms-check {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		font-size: 0.82rem;
		color: var(--ink-2);
		text-align: left;
		margin-bottom: 12px;
		line-height: 1.5;
		cursor: pointer;
	}
	.terms-check input[type='checkbox'] {
		margin-top: 2px;
		flex-shrink: 0;
		width: 16px;
		height: 16px;
		accent-color: var(--accent);
		cursor: pointer;
	}
	.terms-check a {
		color: var(--ink);
		font-weight: 600;
		text-decoration: underline;
		text-decoration-color: var(--line);
		text-underline-offset: 2px;
	}

	.terms-check a:hover {
		color: var(--accent);
		text-decoration-color: var(--accent);
	}

	.submit-btn {
		width: 100%;
		padding: 12px;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: var(--r-md);
		font-size: 0.95rem;
		font-weight: 500;
		font-family: inherit;
		letter-spacing: 0.02em;
		cursor: pointer;
		margin-top: 8px;
		transition: all 0.15s ease;
	}

	.submit-btn:hover:not(:disabled) {
		background: var(--accent-deep);
		transform: translateY(-1px);
	}

	.submit-btn:active:not(:disabled) {
		transform: translateY(0);
	}

	.submit-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.submit-btn:focus {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.divider {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 24px 0;
		color: var(--ink-3);
		font-size: 0.82rem;
		font-weight: 500;
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--line);
	}

	.reset-title {
		font-family: "Zen Antique", serif;
		font-size: 1.05rem; color: var(--ink); letter-spacing: 0.04em;
		margin: 0 0 8px; text-align: center;
	}
	.reset-lead {
		font-size: 0.82rem; color: var(--ink-2); line-height: 1.7;
		margin: 0 0 20px; text-align: center;
	}
	.forgot-link {
		display: block; margin: -6px 0 14px auto;
		background: none; border: none; padding: 0;
		font-family: inherit; font-size: 0.8rem; color: var(--ink-2);
		text-decoration: underline; text-decoration-color: var(--line-strong);
		text-underline-offset: 2px; cursor: pointer;
	}
	.forgot-link:hover { color: var(--accent); text-decoration-color: var(--accent); }
	.back-to-login {
		display: inline-block; margin-top: 18px;
		background: none; border: none; padding: 4px;
		font-family: inherit; font-size: 0.88rem; color: var(--ink-2);
		cursor: pointer; transition: color 0.15s;
	}
	.back-to-login:hover { color: var(--accent); }

	.guest-link {
		color: var(--ink-2);
		font-size: 0.9rem;
		text-decoration: none;
		transition: all 0.15s;
	}

	.guest-link:hover {
		color: var(--accent);
		text-decoration: underline;
		text-decoration-color: var(--accent);
		text-underline-offset: 2px;
	}
</style>
