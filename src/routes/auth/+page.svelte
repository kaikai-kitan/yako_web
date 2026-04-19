<!-- ログイン / 新規登録ページ -->
<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { signIn, signUp } from '$lib/db.js';
	import { supabase, isSupabaseConfigured } from '$lib/supabase.js';

	let mode = $state('signin'); // 'signin' | 'signup'
	let email = $state('');
	let password = $state('');
	let agreedToTerms = $state(false);
	let errorMessage = $state('');
	let successMessage = $state('');
	let isLoading = $state(false);

	onMount(async () => {
		const { data } = await supabase.auth.getSession();
		if (data.session) {
			goto(`${base}/map`);
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
				const { data, error } = await signUp(email, password);
				if (error) throw error;
				if (data.user && !data.user.email_confirmed_at) {
					successMessage =
						'確認メールを送信しました。メールを確認してからログインしてください。';
				} else {
					goto(`${base}/auth/setup`);
				}
			} else {
				const { error } = await signIn(email, password);
				if (error) throw error;
				goto(`${base}/map`);
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
</script>

<div class="auth-page">
	<div class="auth-card">
		<div class="logo">🏮</div>
		<h1 class="title">微小夜行電灯</h1>

		<!-- タブ切り替え -->
		<div class="tab-group">
			<button class="tab" class:active={mode === 'signin'} onclick={() => (mode = 'signin')}>
				ログイン
			</button>
			<button class="tab" class:active={mode === 'signup'} onclick={() => (mode = 'signup')}>
				新規登録
			</button>
		</div>

		{#if errorMessage}
			<p class="error-msg">{errorMessage}</p>
		{/if}
		{#if successMessage}
			<p class="success-msg">{successMessage}</p>
		{/if}

		<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
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
				{:else}
					ログイン
				{/if}
			</button>
		</form>

		<div class="divider">
			<span>または</span>
		</div>

		<a href="{base}/map" class="guest-link">登録なしでマップを見る →</a>
	</div>
</div>

<style>
	.auth-page {
		min-height: 80vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		background: #f8f5f0;
	}

	.auth-card {
		background: white;
		border-radius: 20px;
		padding: 40px 32px;
		width: 100%;
		max-width: 400px;
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
		text-align: center;
	}

	.logo {
		font-size: 3rem;
		margin-bottom: 8px;
	}

	.title {
		font-size: 1.4rem;
		color: #26201a;
		margin: 0 0 28px 0;
	}

	.tab-group {
		display: flex;
		background: #f1f5f9;
		border-radius: 10px;
		padding: 4px;
		margin-bottom: 24px;
	}

	.tab {
		flex: 1;
		padding: 8px;
		border: none;
		background: none;
		border-radius: 8px;
		font-size: 0.9rem;
		color: #64748b;
		cursor: pointer;
		transition: all 0.2s;
	}

	.tab.active {
		background: white;
		color: #0f172a;
		font-weight: bold;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
	}

	.error-msg {
		background: #fee2e2;
		color: #dc2626;
		border-radius: 8px;
		padding: 10px 14px;
		font-size: 0.85rem;
		margin-bottom: 16px;
		text-align: left;
	}

	.success-msg {
		background: #dcfce7;
		color: #166534;
		border-radius: 8px;
		padding: 10px 14px;
		font-size: 0.85rem;
		margin-bottom: 16px;
		text-align: left;
	}

	.field-label {
		display: block;
		text-align: left;
		font-size: 0.85rem;
		color: #475569;
		margin-bottom: 16px;
	}

	.field-input {
		display: block;
		width: 100%;
		margin-top: 6px;
		padding: 10px 14px;
		border: 1.5px solid #e2e8f0;
		border-radius: 8px;
		font-size: 1rem;
		box-sizing: border-box;
		transition: border-color 0.2s;
	}

	.field-input:focus {
		outline: none;
		border-color: #facc15;
	}

	.terms-check {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		font-size: 0.82rem;
		color: #475569;
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
		accent-color: #facc15;
		cursor: pointer;
	}
	.terms-check a {
		color: #26201a;
		font-weight: 600;
		text-decoration: underline;
	}

	.submit-btn {
		width: 100%;
		padding: 12px;
		background: #facc15;
		color: #0f172a;
		border: none;
		border-radius: 10px;
		font-size: 1rem;
		font-weight: bold;
		cursor: pointer;
		margin-top: 8px;
		transition: opacity 0.2s;
	}

	.submit-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.divider {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 20px 0;
		color: #94a3b8;
		font-size: 0.85rem;
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: #e2e8f0;
	}

	.guest-link {
		color: #64748b;
		font-size: 0.9rem;
		text-decoration: none;
	}

	.guest-link:hover {
		color: #0f172a;
		text-decoration: underline;
	}
</style>
