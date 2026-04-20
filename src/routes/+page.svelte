<!-- メインページ -->
<script>
	import ImageSlideshow from '$lib/components/ImageSlideshow.svelte';
	import SplashView from '$lib/components/SplashView.svelte';
	import { base } from '$app/paths';
	import { onMount, onDestroy } from 'svelte';

	import homeData from '$lib/assets/data/home.json';
let splash = $state();

	let phrase1;
	let phrase2;
	let phrase3;
	let scrollTimer;

	function showSplashInNecessary() {
		const noSplashExpirationKey = 'no_splash_expiration_key';
		const noSplashExpirationValue = localStorage.getItem(noSplashExpirationKey);

		// localStorage にキーが存在しなかったら
		if (noSplashExpirationValue !== null) {
			// localStorage に存在する期限を超過しているなら実行
			if (noSplashExpirationValue > Date.now()) {
				return;
			}
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
		const scale = Math.pow(window.innerHeight, 2) / 10;
		[phrase1, phrase2, phrase3].forEach(phrase => {
			const phraseRect = phrase.getBoundingClientRect();
			const phraseCenterY = phraseRect.y + phraseRect.height / 2;
			const delta = Math.pow(phraseCenterY - centerY, 2) / scale;
			const rate = 1 - Math.min(1, delta / 5);
			updateStyle(rate, phrase);
		});

		// Reset to full visibility after scrolling stops
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
	});

	onDestroy(() => {
		window.removeEventListener('scroll', onScrollGallery);
		clearTimeout(scrollTimer);
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

	<div class="messages-container">

	</div>
</main>

<section class="hero">
	<div class="hero-overlay"></div>
	<div class="hero-content">
		<h1 class="hero-title">YATAKARI</h1>
		<p class="hero-subtitle">京都・鴨川の屋台シェアリングサービス</p>
		<a href="{base}/map" class="hero-cta">マップで予約する →</a>
	</div>
</section>

<style>
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

	.hero-cta:hover {
		background: #b85c03;
	}

	main {
		width: 100%;
		box-sizing: border-box;
	}

	.top-gallery-mask {
		width: 100%;
	}

	.top-gallery {
		display: flex;
		position: relative;
		justify-content: center;
		column-gap: 40px;
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

	.phrase-container {
		position: relative;
		width: 80%;
		margin: auto;
		display: flex;
		gap: 1rem;
		flex-direction: row-reverse;
	}

	.description-container {
		position: absolute;
		width: 100%;
		max-width: 800px;
		height: 1800px;
		flex-grow: 1;
		overflow: hidden;
	}

	.phrase-1 {
		top: 200px;
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

</style>
