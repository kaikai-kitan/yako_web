<!-- メインページ -->
<script>
	import ImageSlideshow from '$lib/components/ImageSlideshow.svelte';
	import SplashView from '$lib/components/SplashView.svelte';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';

	import homeData from '$lib/assets/data/home.json';
	import directoryList from '$lib/assets/data/directory.json';

	let splash = $state();
	let phrase1, phrase2, phrase3;
	let gallerySection;
	let networkSection;
	let linesVisible = $state(false);

	// ── 出店スケジュール ──
	let scheduleEvents = $state([]);
	let eventAppearances = $state([]);
	let scheduleLoaded = $state(false);

	const DAY_JA = ['日', '月', '火', '水', '木', '金', '土'];

	function formatEventDate(start, end) {
		const s = new Date(start);
		const isAllDay = !start.includes('T');
		const dateStr = `${s.getMonth() + 1}月${s.getDate()}日（${DAY_JA[s.getDay()]}）`;
		if (isAllDay) return dateStr;
		const pad = (n) => String(n).padStart(2, '0');
		const startTime = `${pad(s.getHours())}:${pad(s.getMinutes())}`;
		if (!end || !end.includes('T')) return `${dateStr} ${startTime}〜`;
		const e = new Date(end);
		const endTime = `${pad(e.getHours())}:${pad(e.getMinutes())}`;
		return `${dateStr} ${startTime}〜${endTime}`;
	}

	function stripHtml(html) {
		return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').trim();
	}

	// ── 夜行人図鑑ノード ──
	const NODE_SVG = [
		{ x: 60,  y: 70  },
		{ x: 300, y: 55  },
		{ x: 55,  y: 215 },
		{ x: 192, y: 155 },
		{ x: 335, y: 210 },
	];
	const EDGES = [[0,1],[0,2],[1,3],[2,3],[3,4],[1,4]];

	// ── スプラッシュ ──
	function showSplashInNecessary() {
		const KEY = 'no_splash_expiration_key';
		const val = localStorage.getItem(KEY);
		if (val !== null && val > Date.now()) return;
		splash.showSplash();
		localStorage.setItem(KEY, Date.now() + 24 * 60 * 60 * 1000);
	}

	// ── ギャラリースクロール ──
	function onScrollGallery() {
		if (!gallerySection) return;

		const HEADER_H = 60;
		const stickyH   = window.innerHeight - HEADER_H;
		const rect       = gallerySection.getBoundingClientRect();
		const totalTravel = gallerySection.offsetHeight - stickyH;
		if (totalTravel <= 0) return;

		// progress: 0(セクション上端が sticky 上端に到達) → 1(セクション下端が sticky 下端に到達)
		const scrolled  = -(rect.top - HEADER_H);
		const progress  = Math.max(0, Math.min(1, scrolled / totalTravel));

		const phrases   = [phrase1, phrase2, phrase3];
		const n         = phrases.length;
		const travel    = stickyH * 0.65; // フレーズが上下に移動する最大距離
		const fadeRange = stickyH * 0.58; // 中心からこの距離で完全に透明（大きいほどくっきり範囲が広い）

		phrases.forEach((el, i) => {
			if (!el) return;

			// pStart を 0.5/n だけ前にシフト → phrase-1 が progress=0 (セクション先頭) で中央に来る
			const pp = (progress - (i - 0.5) / n) / (1 / n);

			// 範囲外は完全に非表示（負の progress = まだ来ていない, > 1 = 通過済み）
			if (pp < -0.5 || pp > 1.5) {
				el.style.opacity   = '0';
				el.style.filter    = '';
				el.style.transform = 'translate(-50%, -50%)'; // 中央に戻す（右への layout overflow を防ぐ）
				return;
			}

			// Y = 0 で中央, 正で下, 負で上
			const clampedPp = Math.max(-0.5, Math.min(1.5, pp));
			const Y = travel * (1 - 2 * clampedPp);

			// 距離ベースの不透明度・ブラー
			const dist    = Math.abs(Y);
			const opacity = Math.max(0, 1 - Math.pow(dist / fadeRange, 1.3));
			const blur    = opacity < 0.99 ? (1 - opacity) * 8 : 0;

			el.style.transform = `translate(-50%, calc(-50% + ${Y}px))`;
			el.style.opacity   = `${opacity}`;
			el.style.filter    = blur > 0 ? `blur(${blur}px)` : '';
		});
	}

	onMount(async () => {
		showSplashInNecessary();

		// 初期位置をセット（ロード時にフレーズが一瞬見えるのを防ぐ）
		onScrollGallery();
		window.addEventListener('scroll', onScrollGallery, { passive: true });

		// 夜行人ネットワーク: 画面内に入ったら線を描画
		const observer = new IntersectionObserver(
			([entry]) => { if (entry.isIntersecting) { linesVisible = true; observer.disconnect(); } },
			{ threshold: 0.15 }
		);
		if (networkSection) observer.observe(networkSection);

		// 出店スケジュール取得
		try {
			const res = await fetch('/api/schedule');
			if (res.ok) {
				const data = await res.json();
				scheduleEvents    = data.events          ?? [];
				eventAppearances  = data.eventAppearances ?? [];
			}
		} catch { /* スケジュール取得失敗時は非表示 */ } finally {
			scheduleLoaded = true;
		}

		return () => {
			window.removeEventListener('scroll', onScrollGallery);
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
	<!--
		gallery-section の高さ = sticky が解除されるまでのスクロール量を決める。
		高さ = sticky コンテナの高さ + (各フレーズの見せたい時間 × フレーズ数)
		280svh → sticky(≈100svh) + 各フレーズ60svh × 3
	-->
	<section class="gallery-section" bind:this={gallerySection}>
		<div class="gallery-sticky">

			<!-- 画像: 常に sticky エリアの中央に固定 -->
			<div class="image-area">
				<ImageSlideshow images={homeData.images} />
			</div>

			<!-- フレーズ: JS がスクロール進捗に応じて Y 位置・透明度・ブラーを制御 -->
			<div class="phrase-layer">
				<div class="phrase-wrap phrase-1" bind:this={phrase1}>
					<span class="description-text">微小夜行電灯</span>
				</div>
				<div class="phrase-wrap phrase-2" bind:this={phrase2}>
					<span class="description-text">京都に流れる鴨川の河川敷で </span>
					<span class="description-text">ゆったりとした時間を過ごせる </span>
				</div>
				<div class="phrase-wrap phrase-3" bind:this={phrase3}>
					<span class="description-text">
						<strong>おもろい空間</strong>を作りたいと思い、
					</span>
					<span class="description-text">京都府を中心に活動をする夜行人です </span>
				</div>
			</div>

		</div>
	</section>
</main>

<!-- イベント出店 -->
{#if scheduleLoaded && eventAppearances.length > 0}
<section class="event-appearance-section">
	<div class="section-header">
		<span class="section-sep event-sep"></span>
		<h2 class="section-title">イベント出店</h2>
		<p class="section-desc">特別なイベント・大規模出店の予定</p>
	</div>
	<div class="event-appearance-list">
		{#each eventAppearances as ev, i}
			<div class="event-appearance-card" class:event-next={i === 0}>
				{#if i === 0}<span class="event-badge-next">NEXT</span>{/if}
				<div class="event-appearance-inner">
					<div class="event-star-col">★</div>
					<div class="event-appearance-body">
						<p class="event-appearance-title">{ev.title || 'イベント出店'}</p>
						<div class="schedule-row">
							<span class="schedule-icon">📅</span>
							<span>{formatEventDate(ev.start, ev.end)}</span>
						</div>
						{#if ev.location}
							<div class="schedule-row">
								<span class="schedule-icon">📍</span>
								<span>{ev.location}</span>
							</div>
						{/if}
						{#if ev.description}
							<div class="schedule-row">
								<span class="schedule-icon">📝</span>
								<span class="schedule-menu">{stripHtml(ev.description)}</span>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/each}
	</div>
</section>
{/if}

<!-- 出店スケジュール -->
{#if scheduleLoaded}
<section class="schedule-section">
	<div class="section-header">
		<span class="section-sep"></span>
		<h2 class="section-title">出店スケジュール</h2>
		<p class="section-desc">次の出店予定</p>
	</div>

	{#if scheduleEvents.length === 0}
		<p class="schedule-empty">現在スケジュールはありません</p>
	{:else}
		<div class="schedule-list">
			{#each scheduleEvents as event, i}
				<div class="schedule-card" class:schedule-next={i === 0}>
					{#if i === 0}<span class="schedule-badge">NEXT</span>{/if}
					<p class="schedule-title">{event.title}</p>
					<div class="schedule-row">
						<span class="schedule-icon">📅</span>
						<span>{formatEventDate(event.start, event.end)}</span>
					</div>
					{#if event.location}
						<div class="schedule-row">
							<span class="schedule-icon">📍</span>
							<span>{event.location}</span>
						</div>
					{/if}
					{#if event.description}
						<div class="schedule-row">
							<span class="schedule-icon">🍽</span>
							<span class="schedule-menu">{stripHtml(event.description)}</span>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</section>
{/if}

<!-- 夜行人図鑑ネットワーク -->
<section class="directory-network-section" bind:this={networkSection}>
	<div class="section-header">
		<span class="section-sep"></span>
		<h2 class="section-title">夜行人図鑑</h2>
		<p class="section-desc">屋台に集まった、ちょっと変わった夜行人たち</p>
	</div>

	<div class="network-wrap">
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
					x1={NODE_SVG[from].x} y1={NODE_SVG[from].y}
					x2={NODE_SVG[to].x}   y2={NODE_SVG[to].y}
					style="transition-delay: {i * 0.18}s"
				/>
			{/each}
		</svg>

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
	.hero-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.45); }
	.hero-content {
		position: relative; z-index: 1; text-align: center; color: #fff;
		padding: 0 24px; display: flex; flex-direction: column;
		align-items: center; gap: 16px;
	}
	.hero-title {
		font-size: clamp(2rem, 8vw, 3.5rem);
		font-weight: 700; letter-spacing: 0.1em; line-height: 1.2;
		text-shadow: 0 2px 12px rgba(0,0,0,0.5);
	}
	.hero-subtitle { font-size: clamp(0.9rem, 3vw, 1.2rem); letter-spacing: 0.05em; opacity: 0.9; }
	.hero-cta {
		display: inline-block; margin-top: 8px; padding: 14px 32px;
		background: #d56d04; color: #fff; text-decoration: none;
		border-radius: 100px; font-size: 1rem; font-weight: 700;
		letter-spacing: 0.05em; box-shadow: 0 4px 16px rgba(0,0,0,0.3);
		transition: background 0.2s;
	}
	.hero-cta:hover { background: #b85c03; }

	/* ===== MAIN ===== */
	main { width: 100%; box-sizing: border-box; }

	/* ===== GALLERY SECTION =====
	   高さがスクロール持続時間を決める:
	     section height = sticky高さ(≈100svh) + フレーズ通過時間(≈60svh × 3)
	   sticky は section が viewport を抜けるまで解除されない。
	   画像の下に余白が生まれないのは、gallery-sticky が height:calc(100svh-60px) で
	   画面いっぱいを占有し、余分な空間を作らないため。
	============================= */
	.gallery-section {
		height: 280svh;
		position: relative;
	}

	/* sticky コンテナ: ヘッダー下から画面いっぱいを占有 */
	.gallery-sticky {
		position: sticky;
		top: 60px; /* 固定ヘッダーの高さ分だけ下 */
		height: calc(100svh - 60px);
		overflow: hidden; /* 画面外のフレーズをクリップ */
		background: #fbf3ea;
	}

	/* 画像: sticky エリアの中央に余白付きで配置 */
	.image-area {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 5vh 8vw;
		box-sizing: border-box;
	}
	@media (min-width: 769px) {
		.image-area { padding: 8vh 16vw; }
	}

	/* フレーズ層: 画像の上に重ねる */
	.phrase-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 1;
	}

	/* 各フレーズ: JS が transform/opacity/filter を上書きする */
	.phrase-wrap {
		position: absolute;
		left: 50%;
		top: 50%;
		/* 初期値: 中央揃え・非表示 (JS 実行前の右 overflow を防ぐ) */
		transform: translate(-50%, -50%);
		opacity: 0;
		width: 90%;
		display: flex;
		gap: 1rem;
		flex-direction: row-reverse;
	}
	.phrase-1 { justify-content: flex-end; }
	.phrase-2 { justify-content: flex-start; }
	.phrase-3 { justify-content: flex-end; }

	.description-text {
		writing-mode: vertical-rl;
		font-size: 20px;
		text-align: center;
		padding: 30px 2px;
		background-color: rgba(255, 255, 255, 0.92);
		box-shadow: 0 10px 10px rgba(0, 0, 0, 0.3);
	}
	.description-text:nth-child(even) {
		transform: translateY(2rem);
	}

	@media (max-width: 480px) {
		.description-text {
			font-size: 14px;
			padding: 16px 2px;
		}
	}

	/* ===== イベント出店 ===== */
	.event-appearance-section {
		padding: 48px 24px 40px;
		background: #fbf3ea;
		text-align: center;
	}
	.event-sep { background: #d56d04; }

	.event-appearance-list {
		display: flex;
		flex-direction: column;
		gap: 14px;
		max-width: 480px;
		margin: 0 auto;
		text-align: left;
		padding-top: 12px; /* NEXT バッジのはみ出し分 */
	}
	.event-appearance-card {
		position: relative;
		background: #fff;
		border: 1.5px solid #e8c97a;
		border-radius: 14px;
		padding: 18px 20px;
		box-shadow: inset 4px 0 0 #d56d04, 0 2px 14px rgba(213, 109, 4, 0.08);
	}
	.event-appearance-card.event-next {
		border-color: #d56d04;
		box-shadow: inset 4px 0 0 #d56d04, 0 4px 20px rgba(213, 109, 4, 0.18);
	}
	.event-badge-next {
		position: absolute;
		top: -11px; left: 16px;
		background: linear-gradient(90deg, #d56d04, #f4a94a);
		color: #fff;
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		padding: 2px 10px;
		border-radius: 20px;
	}
	.event-appearance-inner {
		display: flex;
		gap: 14px;
		align-items: flex-start;
	}
	.event-star-col {
		font-size: 1.4rem;
		color: #d56d04;
		flex-shrink: 0;
		line-height: 1.3;
	}
	.event-appearance-body { flex: 1; display: flex; flex-direction: column; gap: 6px; }
	.event-appearance-title {
		font-size: 1rem;
		font-weight: 700;
		color: #26201a;
		margin: 0;
		line-height: 1.4;
	}

	/* ===== 出店スケジュール ===== */
	.schedule-section {
		padding: 48px 24px 40px;
		background: #fbf3ea;
		text-align: center;
	}
	.schedule-empty {
		font-size: 0.88rem;
		color: #9e9289;
		letter-spacing: 0.03em;
	}
	.schedule-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 480px;
		margin: 0 auto;
		text-align: left;
	}
	.schedule-card {
		position: relative;
		background: #fff;
		border: 1px solid #ede8e0;
		border-radius: 12px;
		padding: 18px 20px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.schedule-card.schedule-next {
		border-color: #d56d04;
		box-shadow: 0 2px 12px rgba(213, 109, 4, 0.12);
	}
	.schedule-badge {
		position: absolute;
		top: -10px;
		left: 16px;
		background: #d56d04;
		color: #fff;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		padding: 2px 10px;
		border-radius: 20px;
	}
	.schedule-title {
		font-size: 1rem;
		font-weight: 700;
		color: #26201a;
		margin: 0;
	}
	.schedule-row {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		font-size: 0.88rem;
		color: #4a3f38;
		line-height: 1.6;
	}
	.schedule-icon {
		flex-shrink: 0;
		width: 20px;
		text-align: center;
	}
	.schedule-menu {
		white-space: pre-wrap;
	}

	/* ===== 夜行人図鑑ネットワーク ===== */
	.directory-network-section {
		padding: 48px 24px 40px;
		background: #fbf3ea;
		text-align: center;
	}
	.section-header {
		display: flex; flex-direction: column; align-items: center;
		gap: 8px; margin-bottom: 32px;
	}
	.section-sep {
		display: block; width: 40px; height: 2px;
		background: #d56d04; border-radius: 2px;
	}
	.section-title { font-size: 1.3rem; font-weight: 700; color: #26201a; letter-spacing: 0.1em; }
	.section-desc  { font-size: 0.85rem; color: #7a6f67; letter-spacing: 0.03em; }

	.network-wrap {
		position: relative;
		width: 100%;
		max-width: 500px;
		aspect-ratio: 400 / 280;
		margin: 0 auto;
	}
	.network-svg {
		position: absolute; inset: 0; width: 100%; height: 100%;
	}
	.network-edge {
		stroke: #d56d04; stroke-width: 1.5; fill: none;
		stroke-dasharray: 600; stroke-dashoffset: 600;
		transition: stroke-dashoffset 0.9s ease;
	}
	.network-svg.animate .network-edge { stroke-dashoffset: 0; }

	.node {
		position: absolute;
		transform: translate(-50%, -50%);
		display: flex; flex-direction: column; align-items: center;
		gap: 4px; text-decoration: none; color: #26201a; z-index: 1;
	}
	.node-img {
		width: 56px; height: 56px; border-radius: 50%;
		object-fit: cover; border: 2px solid #e8e0d8;
		background: #f5f0ea; transition: border-color 0.2s, transform 0.2s;
	}
	.node-placeholder {
		width: 56px; height: 56px; border-radius: 50%;
		background: #f5f0ea; border: 2px solid #e8e0d8;
		display: flex; align-items: center; justify-content: center;
		font-size: 1.1rem; font-weight: 700; color: #7a6f67;
		transition: border-color 0.2s, transform 0.2s;
	}
	.node:hover .node-img,
	.node:hover .node-placeholder { border-color: #d56d04; transform: scale(1.1); }
	.node-label { font-size: 0.7rem; color: #7a6f67; white-space: nowrap; letter-spacing: 0.02em; }

	.directory-more {
		display: inline-block; margin-top: 28px;
		font-size: 0.9rem; color: #d56d04; text-decoration: none;
		letter-spacing: 0.05em; border-bottom: 1px solid transparent;
		transition: border-color 0.2s;
	}
	.directory-more:hover { border-bottom-color: #d56d04; }

	@media (max-width: 480px) {
		.node-img, .node-placeholder { width: 42px; height: 42px; font-size: 0.9rem; }
		.node-label { font-size: 0.6rem; }
	}
</style>
