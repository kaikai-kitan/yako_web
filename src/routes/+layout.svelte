<!-- 基本レイアウト -->
<script>
	import { base } from '$app/paths';
	import favicon from '$lib/assets/favicon.png';
	import 'leaflet/dist/leaflet.css';

	import Header from '$lib/components/Header.svelte';
	import { dev } from '$app/environment';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { page } from '$app/stores';

	injectAnalytics({ mode: dev ? 'development' : 'production' });

	let { children } = $props();

	// /map・/yatakari・/mypage系 はYATAKARIアプリとして別タブで開くためナビ・フッターを非表示
	let hideShell = $derived(
		$page.url.pathname === '/map' ||
		$page.url.pathname.startsWith('/yatakari') ||
		$page.url.pathname.startsWith('/mypage')
	);
</script>

<svelte:head>
	<link rel="icon" href={base + favicon} />
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

{#if !hideShell}<Header />{/if}

{@render children?.()}

{#if !hideShell}
<footer>
	<nav class="footer-links">
		<a href="{base}/terms">利用規約</a>
		<span class="sep">|</span>
		<a href="{base}/tokusho">特定商取引法に基づく表記</a>
	</nav>
	<small class="footer-copy">&copy;2024-2026 微小夜行電灯 All rights reserved</small>
</footer>
{/if}

<style>
	footer {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 24px 16px 32px;
		border-top: 1px solid #ede8e0;
		background: #faf8f5;
	}
	.footer-links {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		justify-content: center;
	}
	.footer-links a {
		font-size: 0.8rem;
		color: #7a6f67;
		text-decoration: none;
	}
	.footer-links a:hover {
		color: #26201a;
		text-decoration: underline;
	}
	.sep {
		font-size: 0.75rem;
		color: #c4b8b0;
	}
	.footer-copy {
		font-size: 0.75rem;
		color: #9e9289;
	}
</style>
