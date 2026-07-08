<!-- プロフィール設定ページ (登録直後) -->
<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';
	import { createUserProfile, getMyProfile } from '$lib/db.js';

	let name = $state('');
	let isLoading = $state(false);
	let errorMessage = $state('');
	let userId = $state('');

	onMount(async () => {
		const { data } = await supabase.auth.getSession();
		if (!data.session) { goto(`${base}/auth`); return; }
		userId = data.session.user.id;

		const profile = await getMyProfile(userId);
		if (profile) goto(`${base}/mypage`);
	});

	async function handleSubmit() {
		errorMessage = '';
		if (!name.trim()) { errorMessage = '名前を入力してください'; return; }
		isLoading = true;
		try {
			await createUserProfile(userId, '購入者', name.trim());
			goto(`${base}/mypage`);
		} catch (e) {
			errorMessage = `登録に失敗しました: ${e.message}`;
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="setup-page">
	<div class="setup-card">
		<img src="{base}/images/icon.png" alt="微小夜行電灯" class="logo-img" />
		<h1 class="title">微小夜行電灯</h1>
		<p class="subtitle">最後にお名前を教えてください</p>

		{#if errorMessage}
			<p class="error-msg">{errorMessage}</p>
		{/if}

		<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
			<label class="field-label">
				お名前
				<input
					type="text"
					bind:value={name}
					class="field-input"
					placeholder="山田 太郎"
					required
	/>
			</label>
			<p class="hint">後からマイページで変更できます</p>
			<button type="submit" class="submit-btn" disabled={isLoading || !name.trim()}>
				{isLoading ? '登録中…' : 'はじめる →'}
			</button>
		</form>
	</div>
</div>

<style>
	.setup-page {
		min-height: 80vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		background: var(--paper);
	}
	.setup-card {
		background: white;
		border-radius: 20px;
		padding: 40px 32px;
		width: 100%;
		max-width: 380px;
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
		text-align: center;
	}
	.logo-img { width: 64px; height: 64px; object-fit: contain; margin: 0 auto 10px; display: block; }
	.title { font-size: 1.3rem; color: var(--ink); margin: 0 0 6px; }
	.subtitle { font-size: 0.9rem; color: var(--ink-2); margin: 0 0 28px; }
	.error-msg {
		background: rgba(184, 92, 43, 0.08);
		color: #dc2626;
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
		color: var(--ink-2);
		margin-bottom: 8px;
	}
	.field-input {
		display: block;
		width: 100%;
		margin-top: 6px;
		padding: 12px 14px;
		border: 1.5px solid var(--line-strong);
		border-radius: 10px;
		font-size: 1rem;
		box-sizing: border-box;
		transition: border-color 0.2s;
	}
	.field-input:focus {
		outline: none;
		border-color: var(--accent);
	}
	.hint {
		font-size: 0.75rem;
		color: var(--ink-3);
		text-align: left;
		margin: 4px 0 20px;
	}
	.submit-btn {
		width: 100%;
		padding: 13px;
		background: var(--accent);
		color: #fff;
		border: none;
		border-radius: 10px;
		font-size: 1rem;
		font-weight: bold;
		cursor: pointer;
		transition: opacity 0.2s;
	}
	.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
