<script>
	import { base } from '$app/paths';
</script>

<svelte:head>
	<title>購入キャンセル | 微小夜行電灯</title>
</svelte:head>

<div class="result-page">
	<div class="result-card">
		<div class="icon cancel">✕</div>
		<h1>購入をキャンセルしました</h1>
		<p class="message">カートの内容は保持されていません。<br />再度ショップからお選びください。</p>
		<a href="{base}/shop" class="btn">ショップに戻る</a>
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
	.cancel { background: #fdecea; color: #c62828; }
	h1 { font-size: 1.2rem; color: #26201a; margin: 0; }
	.message { font-size: 0.88rem; color: #7a6f67; line-height: 1.7; margin: 0; }
	.btn {
		display: block; width: 100%; padding: 13px;
		background: #26201a; color: white;
		border-radius: 10px; text-decoration: none;
		font-size: 0.95rem; font-weight: 700;
	}
</style>
