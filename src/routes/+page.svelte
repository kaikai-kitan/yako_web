<!-- メインページ -->
<script>
	import ImageSlideshow from '$lib/components/ImageSlideshow.svelte';
	import SplashView from '$lib/components/SplashView.svelte';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';

	import homeData from '$lib/assets/data/home.json';
	import directoryList from '$lib/assets/data/directory.json';

	let splash = $state();
	let phrase1;
	let phrase2;
	let phrase3;
	let scrollTimer;
	let networkSection;
	let linesVisible = $state(false);

	// SVG viewBox: 0 0 400 280
	const NODE_SVG = [
		{ x: 60,  y: 70  },  // 0: タオ
		{ x: 300, y: 55  },  // 1: カイドウ
		{ x: 55,  y: 215 },  // 2: ヤニー
		{ x: 192, y: 155 },  // 3: ASKR
		{ x: 335, y: 210 },  // 4: ダー本
	];
	const EDGES = [[0,1],[0,2],[1,3],[2,3],[3,4],[1,4]];

	function showSplashInNecessary() {
		const noSplashExpirationKey = 'no_splash_expiration_key';
		const noSplashExpirationValue = localStorage.getItem(noSplashExpirationKey);
		if (noSplashExpirationValue !== null) {
			if (noSplashExpirationValue > Date.now()) return;
		}
		splash.showSplash();
		const nextExpiration = Date.now() + (24 * 60 * 60 * 1000);
		localStorage.setItem(noSplashExpirationKey, nextExpiration);
	}

	function onScrollGallery() {
		clearTimeout(scrollTimer);

		function updateStyle(rate, element) {
			element.style.opacity = `${rate}`;
			element.style.filter = rate >= 0.99 ? '' : `blur(${(1 - rate) * 10}px)`;
		}

		const centerY = window.innerHeight / 2;
		// 視野の中心±38%の範囲のみくっきり、それ以外はボケる
		const range = window.innerHeight * 0.38;
		[phrase1, phrase2, phrase3].forEach(phrase => {
			const rect = phrase.getBoundingClientRect();
			const phraseCenter = rect.y + rect.height / 2;
			const dist = Math.abs(phraseCenter - centerY);
			const rate = Math.max(0, 1 - Math.pow(dist / range, 1.5));
			updateStyle(rate, phrase);
		});

		scrollTimer = setTimeout(() => {
			[phrase1, phrase2, phrase3].forEach(phrase => {
				phrase.style.opacity = '1';
				phrase.style.filter = '';
			});
		}, 200);
	}

	onMount(() => {
		showSplashInNecessary();
		window.addEventListener('scroll', onScrollGallery, { passive: true });

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					linesVisible = true;
					observer.disconnect();
				}
			},
			{ threshold: 0.15 }
		);
		if (networkSection) observer.observe(networkSection);

		return () => {
			window.removeEventListener('scroll', onScrollGallery);
			clearTimeout(scrollTimer);
			observer.disconnect();
		};
	});
</script>

<svelte:head>
	<title>微小夜行電灯 | 京都・鴨川の屋台シェアリング</title>
	<meta name="description" content="京都の鴨川河川敷で屋台を借りて出店できるシェアリングサービス。屋台・スペースをマップから予約し、当日QRコードで開錠。" />
	<meta property="og:title" content="微小夜行電灯 | 京都・鴨川の屋台シェアリング" />
	<meta property="og:description" content="京都の鴨川河川敷で屋台を借りて出店できるシェアリングサービス。" />
	<meta property="og:url" content="https://yako-web.vercel.app/" />
</svelte:head>

<SplashView bind:this={splash} />

<main>
	<!-- ナビとの間に余白 -->
	<div class="top-gallery-mask">
		<div class="top-gallery">
			<div class="slideshow-container">
				<div class="slideshow">
					<ImageSlideshow images={homeData.images} />
				</div>
			</div>
			<div class="description-container">
				<div class="phrase-container phrase-1" bind:this={phrase1}>
					<span class="description-text">微小夜行電灯</span>
				</div>
				<div class="phrase-container phrase-2" bind:this={phrase2}>
					<span class="description-text">京都に流れる鴨川の河川敷で </span>
					<span class="description-text">ゆったりとした時間を過ごせる </span>
				</div>
				<div class="phrase-container phrase-3" bind:this={phrase3}>
					<span class="description-text">
						<strong>おもろい空間</strong>を作りたいと思い、
					</span>
					<span class="description-text">京都府を中心に活動をする夜行人です </span>
				</div>
			</div>
		</div>
	</div>
</main>

<!-- 夜行人図鑑ネットワーク -->
<section class="directory-network-section" bind:this={networkSection}>
	<div class="section-header">
		<span class="section-sep"></span>
		<h2 class="section-title">夜行人図鑑</h2>
		<p class="section-desc">屋台に集まった、ちょっと変わった夜行人たち</p>
	</div>

	<div class="network-wrap">
		<!-- SVG 接続線 viewBox 0 0 400 280 -->
		<svg
			class="network-svg"
			class:animate={linesVisible}
			viewBox="0 0 400 280"
			preserveAspectRatio="xMidYMid meet"
			aria-hidden="true"
		>
			{#each EDGES as [from, to], i}
				<line
					class="network-edge"
					x1={NODE_SVG[from].x}
					y1={NODE_SVG[from].y}
					x2={NODE_SVG[to].x}
					y2={NODE_SVG[to].y}
					style="transition-delay: {i * 0.18}s"
				/>
			{/each}
		</svg>

		<!-- ノード -->
		{#each directoryList.slice(0, NODE_SVG.length) as person, i}
			<a
				href="{base}/directory"
				class="node"
				style="left: {(NODE_SVG[i].x / 400) * 100}%; top: {(NODE_SVG[i].y / 280) * 100}%"
			>
				{#if person.image}
					<img src="{base + person.image}" alt={person.name} class="node-img" />
				{:else}
					<div class="node-placeholder">{person.name[0]}</div>
				{/if}
				<span class="node-label">{person.name}</span>
			</a>
		{/each}
	</div>

	<a href="{base}/directory" class="directory-more">夜行人図鑑を見る →</a>
</section>

<section class="hero">
	<div class="hero-overlay"></div>
	<div class="hero-content">
		<h1 class="hero-title">YATAKARI</h1>
		<p class="hero-subtitle">京都・鴨川の屋台シェアリングサービス</p>
		<a href="{base}/map" class="hero-cta">マップで予約する →</a>
	</div>
</section>

<style>
	/* ===== HERO ===== */
	.hero {
		position: relative;
		width: 100%;
		min-height: 70svh;
		background-image: url('/images/back_yatai_road.png');
		background-size: cover;
		background-position: center;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}
	.hero-overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
	}
	.hero-content {
		position: relative;
		z-index: 1;
		text-align: center;
		color: #fff;
		padding: 0 24px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}
	.hero-title {
		font-size: clamp(2rem, 8vw, 3.5rem);
		font-weight: 700;
		letter-spacing: 0.1em;
		line-height: 1.2;
		text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
	}
	.hero-subtitle {
		font-size: clamp(0.9rem, 3vw, 1.2rem);
		letter-spacing: 0.05em;
		opacity: 0.9;
	}
	.hero-cta {
		display: inline-block;
		margin-top: 8px;
		padding: 14px 32px;
		background: #d56d04;
		color: #fff;
		text-decoration: none;
		border-radius: 100px;
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
		transition: background 0.2s;
	}
	.hero-cta:hover { background: #b85c03; }

	/* ===== MAIN / GALLERY ===== */
	main {
		width: 100%;
		box-sizing: border-box;
	}

	.top-gallery-mask {
		width: 100%;
		padding-top: 16px; /* ナビとの間の余白 */
	}

	.top-gallery {
		display: flex;
		position: relative;
		justify-content: center;
		/* column-gap 削除: 左ズレの原因になる可能性 */
	}

	.slideshow-container {
		flex-grow: 1;
		width: 100%;
		max-width: 800px;
		height: 1600px;
	}

	.slideshow {
		position: sticky;
		top: 10%;
	}

	/* フレーズ: position:absolute でオーバーフロークリップを回避 */
	.description-container {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		margin: auto;
		width: 100%;
		max-width: 800px;
		height: 2000px;
		overflow: hidden;
	}

	.phrase-container {
		position: absolute;
		left: 0;
		right: 0;
		margin: 0 auto;
		width: 80%;
		display: flex;
		gap: 1rem;
		flex-direction: row-reverse;
	}

	.phrase-1 {
		top: calc(10vh + min(28.125vw, 225px) - 150px);
		justify-content: flex-end;
	}
	.phrase-2 {
		top: 650px;
		justify-content: flex-start;
	}
	.phrase-3 {
		top: 1100px;
		justify-content: flex-end;
	}

	.description-text {
		writing-mode: vertical-rl;
		font-size: 20px;
		text-align: center;
		padding: 30px 2px;
		background-color: #ffffff;
		box-shadow: 0 10px 10px rgba(0, 0, 0, 0.3);
	}
	.description-text:nth-child(even) {
		transform: translateY(2rem);
	}

	/* スマホ: テキストを小さく */
	@media (max-width: 480px) {
		.description-text {
			font-size: 14px;
			padding: 16px 2px;
		}
	}

	/* ===== 夜行人図鑑ネットワーク ===== */
	.directory-network-section {
		padding: 48px 24px 40px;
		background: #faf8f5;
		text-align: center;
	}

	.section-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		margin-bottom: 32px;
	}
	.section-sep {
		display: block;
		width: 40px;
		height: 2px;
		background: #d56d04;
		border-radius: 2px;
	}
	.section-title {
		font-size: 1.3rem;
		font-weight: 700;
		color: #26201a;
		letter-spacing: 0.1em;
	}
	.section-desc {
		font-size: 0.85rem;
		color: #7a6f67;
		letter-spacing: 0.03em;
	}

	/* ネットワーク図コンテナ */
	.network-wrap {
		position: relative;
		width: 100%;
		max-width: 500px;
		aspect-ratio: 400 / 280;
		margin: 0 auto;
	}

	/* SVG 接続線 */
	.network-svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.network-edge {
		stroke: #d56d04;
		stroke-width: 1.5;
		fill: none;
		stroke-dasharray: 600;
		stroke-dashoffset: 600;
		transition: stroke-dashoffset 0.9s ease;
	}
	.network-svg.animate .network-edge {
		stroke-dashoffset: 0;
	}

	/* ノード */
	.node {
		position: absolute;
		transform: translate(-50%, -50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		text-decoration: none;
		color: #26201a;
		z-index: 1;
	}
	.node-img {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid #e8e0d8;
		background: #f5f0ea;
		transition: border-color 0.2s, transform 0.2s;
	}
	.node-placeholder {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: #f5f0ea;
		border: 2px solid #e8e0d8;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.1rem;
		font-weight: 700;
		color: #7a6f67;
		transition: border-color 0.2s, transform 0.2s;
	}
	.node:hover .node-img,
	.node:hover .node-placeholder {
		border-color: #d56d04;
		transform: scale(1.1);
	}
	.node-label {
		font-size: 0.7rem;
		color: #7a6f67;
		white-space: nowrap;
		letter-spacing: 0.02em;
	}

	.directory-more {
		display: inline-block;
		margin-top: 28px;
		font-size: 0.9rem;
		color: #d56d04;
		text-decoration: none;
		letter-spacing: 0.05em;
		border-bottom: 1px solid transparent;
		transition: border-color 0.2s;
	}
	.directory-more:hover {
		border-bottom-color: #d56d04;
	}

	/* スマホでのノードサイズ縮小 */
	@media (max-width: 480px) {
		.node-img,
		.node-placeholder {
			width: 42px;
			height: 42px;
			font-size: 0.9rem;
		}
		.node-label {
			font-size: 0.6rem;
		}
	}
</style>
