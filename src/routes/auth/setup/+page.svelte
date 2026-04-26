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
		if (profile) goto(`${base}/shop`);
	});

	async function handleSubmit() {
		errorMessage = '';
		if (!name.trim()) { errorMessage = '名前を入力してください'; return; }
		isLoading = true;
		try {
			await createUserProfile(userId, '購入者', name.trim());
			goto(`${base}/shop`);
		} catch (e) {
			errorMessage = `登録に失敗しました: ${e.message}`;
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="setup-page">
	<div class="setup-card">
		<div class="logo">🏮</div>
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
		background: #f8f5f0;
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
	.logo { font-size: 3rem; margin-bottom: 8px; }
	.title { font-size: 1.3rem; color: #26201a; margin: 0 0 6px; }
	.subtitle { font-size: 0.9rem; color: #64748b; margin: 0 0 28px; }
	.error-msg {
		background: #fee2e2;
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
		color: #475569;
		margin-bottom: 8px;
	}
	.field-input {
		display: block;
		width: 100%;
		margin-top: 6px;
		padding: 12px 14px;
		border: 1.5px solid #e2e8f0;
		border-radius: 10px;
		font-size: 1rem;
		box-sizing: border-box;
		transition: border-color 0.2s;
	}
	.field-input:focus {
		outline: none;
		border-color: #d56d04;
	}
	.hint {
		font-size: 0.75rem;
		color: #94a3b8;
		text-align: left;
		margin: 4px 0 20px;
	}
	.submit-btn {
		width: 100%;
		padding: 13px;
		background: #d56d04;
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
