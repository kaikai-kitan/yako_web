<!-- 基本レイアウト -->
<script>
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import favicon from '$lib/assets/favicon.png';
	import 'leaflet/dist/leaflet.css';

	import Header from '$lib/components/Header.svelte';
	import PreFooter from '$lib/components/PreFooter.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import { page } from '$app/stores';
	import { session } from '$lib/auth.js';
	import { supabase } from '$lib/supabase.js';

	let { children } = $props();

	// onMount はブラウザでのみ実行されるため browser チェック不要
	onMount(() => {
		supabase.auth.getSession().then(({ data }) => {
			session.set(data.session);
		});

		const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
			session.set(newSession);
		});

		return () => subscription.unsubscribe();
	});

	// YATAKARIアプリの範囲。トップ（事業サイト）のヘッダー/フッターは隠し、5タブのボトムナビを出す。
	const APP_PREFIXES = ['/map', '/yatakari', '/mypage', '/directory', '/network', '/groups', '/shop', '/contact'];
	let path = $derived($page.url.pathname);
	let isApp = $derived(APP_PREFIXES.some((p) => path === p || path.startsWith(p + '/')));
	let hideShell = $derived(isApp);
	// 共有ボトムナビを出さない画面:
	//  - /yatakari（起動スプラッシュ）
	//  - /network とグループ詳細（全画面3D＋独自の下部CTAと衝突するため）
	let showBottomNav = $derived(
		isApp
		&& !path.startsWith('/yatakari')
		&& !path.startsWith('/network')
		&& !(/^\/groups\/[^/]+$/.test(path) && path !== '/groups/join')
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
	<meta property="og:image" content="/images/shop/yatai.jpg" />
	<meta property="og:url" content="https://yako-web.pages.dev/" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

{#if !hideShell}<Header />{/if}

<div class:app-body={showBottomNav}>
	{@render children?.()}
</div>

{#if showBottomNav}<BottomNav />{/if}

{#if !hideShell}<PreFooter />{/if}

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
	/* ボトムナビ分の余白（固定ナビに隠れないように） */
	.app-body { padding-bottom: calc(64px + env(safe-area-inset-bottom, 0)); min-height: 100svh; box-sizing: border-box; }
	footer {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 24px 16px 32px;
		border-top: 1px solid var(--line);
		background: var(--surface-sunk);
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
		color: var(--ink-2);
		text-decoration: none;
	}
	.footer-links a:hover {
		color: var(--ink);
		text-decoration: underline;
	}
	.sep {
		font-size: 0.75rem;
		color: #c4b8b0;
	}
	.footer-copy {
		font-size: 0.75rem;
		color: var(--ink-3);
	}
</style>
