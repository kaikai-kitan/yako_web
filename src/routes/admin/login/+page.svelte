<svelte:head>
	<title>管理者ログイン | 微小夜行電灯</title>
</svelte:head>

<script>
	let password = $state('');
	let error = $state('');
	let isLoading = $state(false);

	async function submit(e) {
		e.preventDefault();
		isLoading = true;
		error = '';

		const res = await fetch('/api/admin/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ password })
		});

		isLoading = false;

		if (res.ok) {
			window.location.href = '/admin';
		} else {
			error = 'パスワードが正しくありません。';
			password = '';
		}
	}
</script>

<div class="page">
	<div class="card">
		<h1 class="title">管理者ログイン</h1>
		<form onsubmit={submit}>
			<input
				type="password"
				bind:value={password}
				placeholder="パスワード"
				class="input"
				required
			/>
			{#if error}
				<p class="error">{error}</p>
			{/if}
			<button type="submit" class="btn" disabled={isLoading}>
				{isLoading ? 'ログイン中...' : 'ログイン'}
			</button>
		</form>
	</div>
</div>

<style>
	.page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #faf8f5;
	}
	.card {
		background: #fff;
		border: 1px solid #e8e0d8;
		border-radius: 16px;
		padding: 40px 32px;
		width: 100%;
		max-width: 360px;
	}
	.title {
		font-size: 1.2rem;
		font-weight: 700;
		margin: 0 0 24px;
		text-align: center;
		color: #26201a;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.input {
		padding: 10px 14px;
		border: 1px solid #ddd;
		border-radius: 8px;
		font-size: 1rem;
		width: 100%;
		box-sizing: border-box;
	}
	.input:focus {
		outline: 2px solid #d56d04;
		border-color: transparent;
	}
	.error {
		font-size: 0.85rem;
		color: #c0392b;
		margin: 0;
	}
	.btn {
		padding: 10px;
		background: #26201a;
		color: #fff;
		border: none;
		border-radius: 8px;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
	}
	.btn:disabled {
		background: #bbb;
		cursor: default;
	}
</style>
