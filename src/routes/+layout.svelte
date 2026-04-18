<!-- 基本レイアウト -->
<script>
	import { base } from '$app/paths';
	import favicon from '$lib/assets/favicon.png';

	import Header from '$lib/components/Header.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={base + favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
	<link href="https://fonts.googleapis.com/css2?family=Zen+Antique&display=swap" rel="stylesheet" />

	<link rel="stylesheet" href="{base}/global.css" />

	<!-- デフォルトSEO・OGP（各ページで上書き可能） -->
	<title>微小夜行電灯</title>
	<meta name="description" content="京都・鴨川河川敷で屋台を借りて出店できるシェアリングサービス。屋台・スペースの予約からオンラインショップまで。" />
	<meta property="og:site_name" content="微小夜行電灯" />
	<meta property="og:type" content="website" />
	<meta property="og:title" content="微小夜行電灯" />
	<meta property="og:description" content="京都・鴨川河川敷で屋台を借りて出店できるシェアリングサービス。" />
	<meta property="og:image" content="https://yako-web.vercel.app/images/shop/yatai.jpg" />
	<meta property="og:url" content="https://yako-web.vercel.app/" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<Header />

{@render children?.()}

<footer>
	<small>&copy;2025 All rights reserved</small>
</footer>

<style>
	footer {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
