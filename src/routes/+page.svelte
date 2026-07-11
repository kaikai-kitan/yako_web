<!-- メインページ -->
<script>
	import ImageSlideshow from '$lib/components/ImageSlideshow.svelte';
	import SplashView from '$lib/components/SplashView.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';

	import homeData from '$lib/assets/data/home.json';
	import company from '$lib/assets/data/company.json';

	let splash = $state();
	let phrase1, phrase2, phrase3;
	let gallerySection;

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


	// ── ニュース（掲載・受賞） ──
	const newsList = [
		{
			source: '京都新聞 夕刊',
			year: '2025',
			date: '6月16日',
			title: '京都産業大学の学生2人、お手製屋台で走り出す ―「交流を楽しむ場に」',
			image: '/images/news/kyoto_newspaper.jpg',
			url: 'https://www.kyoto-np.co.jp/articles/-/1494513'
		},
		{
			source: 'KSU Letter 2025',
			year: '2025',
			date: '',
			title: '大学広報誌「KSU Letter」に掲載されました',
			image: '/images/news/ksu_letter.jpg',
			url: 'https://www.kyoto-su.ac.jp/mt_uploads/ksuletter_2025.pdf'
		},
		{
			source: '京都産業大学',
			year: '2025',
			date: '2月21日',
			title: 'ビジネスプランコンテストで受賞しました',
			image: '/images/news/ksu_business.jpg',
			url: 'https://www.kyoto-su.ac.jp/news/news-000598.html'
		}
	];

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
		const travel    = stickyH * 0.70; // フレーズが上下に移動する最大距離
		const fadeRange = stickyH * 0.55; // 中心からこの距離で完全に透明

		phrases.forEach((el, i) => {
			if (!el) return;

			// pStart を 0.5/n だけ前にシフト → phrase-1 が progress=0 で中央に来る
			const pp = (progress - (i - 0.5) / n) / (1 / n);

			// 範囲外は完全に非表示
			if (pp < -0.5 || pp > 1.5) {
				el.style.opacity   = '0';
				el.style.filter    = '';
				el.style.transform = 'translate(-50%, -50%)';
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
<section class="directory-network-section">
	<div class="section-header">
		<span class="section-sep"></span>
		<h2 class="section-title">夜行人ネットワーク</h2>
		<p class="section-desc">屋台での一夜の出会いを、夜の人脈に。</p>
	</div>

	<div class="net-layout">
		<!-- 何ができるか（3ステップ） -->
		<ol class="net-steps">
			<li class="net-step">
				<span class="net-step-ic"><Icon name="yatai" size={22} /></span>
				<div class="net-step-body">
					<strong>屋台で出会う</strong>
					<p>夜の屋台で、ちょっと変わった人と隣り合う。</p>
				</div>
			</li>
			<li class="net-step">
				<span class="net-step-ic"><Icon name="qr-code" size={22} /></span>
				<div class="net-step-body">
					<strong>QRでつながる</strong>
					<p>お互いのQRを読み取れば「夜行人」として登録。実名や連絡先は不要。</p>
				</div>
			</li>
			<li class="net-step">
				<span class="net-step-ic"><Icon name="share" size={22} /></span>
				<div class="net-step-body">
					<strong>縁が星図に広がる</strong>
					<p>つながりは3Dネットワーク（星図）として可視化され、夜ごとに育っていく。</p>
				</div>
			</li>
		</ol>
	</div>

	<div class="net-ctas">
		<a href="{base}/directory" class="net-cta primary">夜行人図鑑を見る →</a>
		<a href="{base}/yakonin/setup" class="net-cta ghost">夜行人になる</a>
	</div>
</section>

<!-- ニュース（掲載・受賞） -->
<section class="news-section">
	<div class="section-header">
		<span class="section-sep"></span>
		<h2 class="section-title">ニュース</h2>
		<p class="section-desc">メディア掲載・受賞のお知らせ</p>
	</div>

	<div class="news-grid">
		{#each newsList as item}
			<a class="news-card" href={item.url} target="_blank" rel="noopener noreferrer">
				<div class="news-thumb">
					<img src="{base + item.image}" alt={item.title} loading="lazy" decoding="async" />
					<span class="news-thumb-label">{item.source}</span>
				</div>
				<div class="news-body">
					<span class="news-date">
						<span class="news-year">{item.year}年</span>{#if item.date}<span class="news-md">{item.date}</span>{/if}
					</span>
					<p class="news-title">{item.title}</p>
					<span class="news-more">記事を読む →</span>
				</div>
			</a>
		{/each}
	</div>
</section>

<!-- 活動実績 -->
<section class="works-section">
	<div class="section-header">
		<span class="section-sep"></span>
		<h2 class="section-title">活動実績</h2>
		<p class="section-desc">京都・鴨川の夜に灯してきた屋台の記録</p>
	</div>

	<div class="works-scroll">
		<div class="works-track">
			{#each company.gallery as image}
				<div class="works-item">
					<img src="{base + image}" alt="活動実績" loading="lazy" decoding="async" />
				</div>
			{/each}
		</div>
	</div>

	<div class="works-cta-wrap">
		<a href="{base}/company" class="works-link">会社概要を見る →</a>
		<a href="{base}/yatakari" class="works-cta" target="_blank" rel="noopener">マップで予約する →</a>
	</div>
</section>

<style>
	/* ===== 活動実績 ===== */
	.works-section { padding: 3rem 0 4rem; }
	.works-scroll {
		width: 100vw; margin-left: calc(50% - 50vw); margin-top: 1.6rem;
		overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none;
	}
	.works-scroll::-webkit-scrollbar { display: none; }
	.works-track {
		display: flex; gap: 12px; width: max-content;
		padding: 0 max(20px, calc(50% - 320px)) 6px;
		scroll-snap-type: x mandatory;
	}
	.works-item {
		flex-shrink: 0; width: min(70vw, 260px); aspect-ratio: 4 / 3;
		scroll-snap-align: center; border-radius: 12px; overflow: hidden;
		box-shadow: var(--shadow-1); background: var(--surface-sunk);
	}
	.works-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
	.works-cta-wrap { display: flex; flex-direction: column; align-items: center; gap: 14px; margin-top: 2rem; }
	.works-link { font-size: 0.9rem; color: var(--accent-deep); text-decoration: none; border-bottom: 1px solid var(--accent); padding-bottom: 2px; letter-spacing: 0.04em; }
	.works-link:hover { color: var(--accent); }
	.works-cta {
		display: inline-block; padding: 13px 34px; background: var(--accent); color: #fff;
		text-decoration: none; border-radius: 100px; font-size: 0.98rem; font-weight: 700;
		letter-spacing: 0.05em; box-shadow: var(--shadow-2); transition: background 0.2s;
	}
	.works-cta:hover { background: var(--accent-deep); }

	/* ===== MAIN ===== */
	main { width: 100%; box-sizing: border-box; }

	/* ===== GALLERY SECTION =====
	   高さがスクロール持続時間を決める:
	     section height = sticky高さ(≈100svh) + フレーズ通過時間(≈40svh × 3)
	   sticky は section が viewport を抜けるまで解除されない。
	============================= */
	.gallery-section {
		height: 220svh;
		position: relative;
	}

	/* sticky コンテナ: ヘッダー下から画面いっぱいを占有 */
	.gallery-sticky {
		position: sticky;
		top: 60px; /* 固定ヘッダーの高さ分だけ下 */
		height: calc(100svh - 60px);
		overflow: hidden; /* 画面外のフレーズをクリップ */
		background: var(--surface-sunk);
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
		transform: translate(-50%, -50%);
		opacity: 0;
		width: 100%;
		max-width: 800px;
		padding: 0 5%;
		box-sizing: border-box;
		display: flex;
		gap: 1.5rem;
		flex-direction: row-reverse; /* 縦書きのため右から左への流れ */
		align-items: flex-start;
	}

	/* row-reverse のため start=右、end=左 */
	.phrase-1 { justify-content: flex-end; }   /* 左寄り：微小夜行電灯 */
	.phrase-2 { justify-content: flex-start; } /* 右寄り：京都に流れる鴨川の… */
	.phrase-3 { justify-content: flex-end; }   /* 左寄り：おもろい空間を… */

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
		background: var(--surface-sunk);
		text-align: center;
	}
	.event-sep { background: var(--accent); }

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
		box-shadow: inset 4px 0 0 var(--accent), 0 2px 14px rgba(213, 109, 4, 0.08);
	}
	.event-appearance-card.event-next {
		border-color: var(--accent);
		box-shadow: inset 4px 0 0 var(--accent), 0 4px 20px rgba(213, 109, 4, 0.18);
	}
	.event-badge-next {
		position: absolute;
		top: -11px; left: 16px;
		background: linear-gradient(90deg, var(--accent), #f4a94a);
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
		color: var(--accent);
		flex-shrink: 0;
		line-height: 1.3;
	}
	.event-appearance-body { flex: 1; display: flex; flex-direction: column; gap: 6px; }
	.event-appearance-title {
		font-size: 1rem;
		font-weight: 700;
		color: var(--ink);
		margin: 0;
		line-height: 1.4;
	}

	/* ===== 出店スケジュール ===== */
	.schedule-section {
		padding: 48px 24px 40px;
		background: var(--surface-sunk);
		text-align: center;
	}
	.schedule-empty {
		font-size: 0.88rem;
		color: var(--ink-3);
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
		border: 1px solid var(--line);
		border-radius: 12px;
		padding: 18px 20px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.schedule-card.schedule-next {
		border-color: var(--accent);
		box-shadow: 0 2px 12px rgba(213, 109, 4, 0.12);
	}
	.schedule-badge {
		position: absolute;
		top: -10px;
		left: 16px;
		background: var(--accent);
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
		color: var(--ink);
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
		background: var(--surface-sunk);
		text-align: center;
	}
	.section-header {
		display: flex; flex-direction: column; align-items: center;
		gap: 8px; margin-bottom: 32px;
	}
	.section-sep {
		display: block; width: 40px; height: 2px;
		background: var(--accent); border-radius: 2px;
	}
	.section-title { font-size: 1.3rem; font-weight: 700; color: var(--ink); letter-spacing: 0.1em; }
	.section-desc  { font-size: 0.85rem; color: var(--ink-2); letter-spacing: 0.03em; }

	/* レイアウト: ステップ説明 */
	.net-layout {
		max-width: 560px;
		margin: 0 auto;
	}

	/* 何ができるか: 3ステップ */
	.net-steps {
		list-style: none; margin: 0; padding: 0;
		display: flex; flex-direction: column; gap: 14px;
		text-align: left;
	}
	.net-step {
		display: flex; align-items: flex-start; gap: 14px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--r-lg);
		padding: 16px 18px;
		box-shadow: var(--shadow-1);
		margin: 0;
	}
	.net-step-ic {
		flex-shrink: 0;
		width: 42px; height: 42px; border-radius: 12px;
		display: inline-flex; align-items: center; justify-content: center;
		background: var(--accent-tint); color: var(--accent);
	}
	.net-step-body strong { display: block; font-size: 0.98rem; color: var(--ink); margin-bottom: 3px; }
	.net-step-body p { font-size: 0.82rem; color: var(--ink-2); line-height: 1.6; margin: 0; }

	/* CTA */
	.net-ctas {
		display: flex; flex-wrap: wrap; gap: 12px;
		justify-content: center; align-items: center;
		margin-top: 32px;
	}
	.net-cta {
		display: inline-flex; align-items: center; justify-content: center;
		padding: 12px 24px; border-radius: 100px;
		font-size: 0.92rem; font-weight: 600; text-decoration: none;
		letter-spacing: 0.03em; transition: all 0.15s ease;
	}
	.net-cta.primary {
		background: var(--accent); color: #fff;
		box-shadow: 0 2px 10px rgba(184, 92, 43, 0.25);
	}
	.net-cta.primary:hover { background: var(--accent-deep); transform: translateY(-1px); }
	.net-cta.ghost {
		background: none; color: var(--ink); border: 1.5px solid var(--line-strong);
	}
	.net-cta.ghost:hover { border-color: var(--accent); color: var(--accent); }

	/* ===== ニュース ===== */
	.news-section {
		padding: 48px 24px 52px;
		background: var(--paper);
		text-align: center;
	}
	.news-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 20px;
		max-width: 920px;
		margin: 0 auto;
	}
	.news-card {
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--r-lg);
		overflow: hidden;
		text-decoration: none;
		text-align: left;
		box-shadow: var(--shadow-1);
		transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
	}
	.news-card:hover {
		transform: translateY(-3px);
		box-shadow: var(--shadow-2);
		border-color: var(--line-strong);
	}
	/* サムネイル */
	.news-thumb {
		position: relative;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		background: var(--surface-sunk);
	}
	.news-thumb img {
		width: 100%; height: 100%;
		object-fit: cover; display: block;
		transition: transform 0.3s ease;
	}
	.news-card:hover .news-thumb img { transform: scale(1.05); }
	.news-thumb-label {
		position: absolute;
		left: 12px; bottom: 10px;
		color: #fff;
		font-size: 0.72rem; font-weight: 600;
		letter-spacing: 0.06em;
		background: rgba(0,0,0,0.42);
		padding: 3px 9px; border-radius: 100px;
		backdrop-filter: blur(2px);
	}

	.news-body {
		padding: 16px 16px 18px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		flex: 1;
	}
	.news-date {
		display: inline-flex; align-items: baseline; gap: 6px;
		font-size: 0.78rem; color: var(--ink-3); letter-spacing: 0.04em;
	}
	.news-year { font-weight: 700; color: var(--accent); }
	.news-title {
		font-size: 0.95rem; line-height: 1.55; color: var(--ink);
		font-weight: 600; font-family: "Zen Antique", serif;
		flex: 1;
	}
	.news-more {
		font-size: 0.8rem; color: var(--ink-2); letter-spacing: 0.04em;
		transition: color 0.15s;
	}
	.news-card:hover .news-more { color: var(--accent); }

	@media (max-width: 720px) {
		.news-grid { grid-template-columns: 1fr; max-width: 420px; gap: 16px; }
		.news-thumb { aspect-ratio: 21 / 9; }
	}

</style>
