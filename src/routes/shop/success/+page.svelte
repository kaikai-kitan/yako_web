<script>
	import { base } from '$app/paths';
</script>

<svelte:head>
	<title>ご注文ありがとうございます | 微小夜行電灯</title>
</svelte:head>

<div class="result-page">
	<div class="result-card">
		<div class="icon success">✓</div>
		<h1>ご注文ありがとうございます！</h1>
		<p class="message">
			お支払いが完了しました。<br />
			ご登録のメールアドレスに確認メールをお送りします。
		</p>
		<a href="{base}/shop" class="btn">ショップに戻る</a>
		<a href="{base}/" class="btn ghost">トップページへ</a>
	</div>
</div>

<style>
	.result-page {
		min-height: 100svh; background: #faf8f5;
		display: flex; align-items: center; justify-content: center; padding: 20px;
	}
	.result-card {
		background: white; border-radius: 20px;
		padding: 40px 28px; max-width: 360px; width: 100%;
		text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.08);
		display: flex; flex-direction: column; align-items: center; gap: 16px;
	}
	.icon {
		width: 72px; height: 72px; border-radius: 50%;
		display: flex; align-items: center; justify-content: center;
		font-size: 2rem; font-weight: 700;
	}
	.success { background: #e8f5e9; color: #2e7d32; }
	h1 { font-size: 1.2rem; color: #26201a; margin: 0; }
	.message { font-size: 0.88rem; color: #7a6f67; line-height: 1.7; margin: 0; }
	.btn {
		display: block; width: 100%; padding: 13px;
		background: #26201a; color: white;
		border-radius: 10px; text-decoration: none;
		font-size: 0.95rem; font-weight: 700;
	}
	.btn.ghost {
		background: none; border: 1.5px solid #26201a; color: #26201a;
	}
</style>
