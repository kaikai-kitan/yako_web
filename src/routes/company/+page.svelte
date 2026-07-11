<!-- 会社概要（ビジョン先行 → 事業内容 → 活動実績） -->
<script>
	import company from '$lib/assets/data/company.json';
	import ImageModalView from '$lib/components/ImageModalView.svelte';
	import ImageView from '$lib/components/ImageView.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let imageModalView = $state();

	// YATAKARI プラットフォームの機能（絵文字→UIキットのアイコンに統一）
	const services = [
		{ icon: 'map',            name: 'リアルタイムマップ',   desc: '出店中の屋台をマップで確認' },
		{ icon: 'clipboard-list', name: '予約・スペース管理',    desc: '屋台・場所をオンライン予約' },
		{ icon: 'qr-code',        name: 'QR出退店',            desc: 'QRコードで簡単に出退店記録' },
		{ icon: 'shopping-bag',   name: 'オンラインストア',      desc: '店舗商品のEC販売' },
		{ icon: 'package',        name: '在庫管理',            desc: '食材・消耗品の在庫を一元管理' },
		{ icon: 'bar-chart',      name: '収益ダッシュボード',    desc: '売上・精算状況をリアルタイム集計' }
	];
</script>

<svelte:head><title>会社概要 | 微小夜行電灯</title></svelte:head>

<div class="company-hero">
	<div class="company-hero-overlay"></div>
	<div class="company-hero-inner">
		<span class="hero-kicker">COMPANY</span>
		<h1 class="company-hero-title">会社概要</h1>
	</div>
</div>

<main>
	<!-- ビジョン -->
	<section class="vision">
		<span class="vision-kicker">OUR VISION</span>
		<h2 class="vision-lead">1万円で、<br class="sp-br" />あなたを店主に。</h2>
		<p class="vision-body">
			場所・ノウハウ・コスト——起業をはばむ三つの壁を、私たちは<strong>屋台</strong>で取り払います。
			アイデアさえあれば、今夜からあなたも店を持てる。
			京都・鴨川のほとりから、誰もが挑戦できる“動くまち”をつくります。
		</p>
	</section>

	<!-- ミッション -->
	<section class="mission">
		<div class="mission-head">
			<span class="section-sep"></span>
			<h2 class="section-title">私たちがすること</h2>
		</div>
		<p class="mission-body">{company.summary}</p>
		<ul class="pillars">
			<li class="pillar">
				<span class="pillar-ic"><Icon name="store" size={22} /></span>
				<div>
					<strong>始めやすさを、屋台で。</strong>
					<p>初期費用や許認可のハードルを下げ、“今日から店主”になれる入口を用意します。</p>
				</div>
			</li>
			<li class="pillar">
				<span class="pillar-ic"><Icon name="map-pin" size={22} /></span>
				<div>
					<strong>京都の夜に、賑わいを。</strong>
					<p>鴨川周辺の空き地・空き時間を束ね、日替わりの屋台村として街に灯りをともします。</p>
				</div>
			</li>
			<li class="pillar">
				<span class="pillar-ic"><Icon name="handshake" size={22} /></span>
				<div>
					<strong>出会いを、夜の人脈に。</strong>
					<p>屋台での一夜の出会いを「夜行人ネットワーク」としてつなぎ、挑戦者どうしの縁を育てます。</p>
				</div>
			</li>
		</ul>
	</section>

	<!-- 事業内容 -->
	<section class="businesses">
		<div class="mission-head">
			<span class="section-sep"></span>
			<h2 class="section-title">事業内容</h2>
		</div>

		{#each company.businesses as business}
			<div class="business-container">
				<h3 class="business-name">{business.name}</h3>
				<span class="separator"></span>
				<p class="business-description">{business.description}</p>
			</div>

			{#if business.name === '京産屋台化計画'}
				<!-- YATAKARI サービス紹介 -->
				<div class="yatakari-section">
					<div class="yatakari-header">
						<span class="yatakari-brand"><Icon name="yatai" size={30} /></span>
						<div class="yatakari-title-block">
							<span class="yatakari-label">デジタル基盤</span>
							<h4 class="yatakari-title">YATAKARI</h4>
							<p class="yatakari-subtitle">屋台出店をワンストップで支援するプラットフォーム</p>
						</div>
					</div>

					<div class="service-grid">
						{#each services as s}
							<div class="service-card">
								<span class="service-icon"><Icon name={s.icon} size={26} /></span>
								<span class="service-name">{s.name}</span>
								<span class="service-desc">{s.desc}</span>
							</div>
						{/each}
					</div>

					<div class="yatakari-cta-wrap">
						<a href="/yatakari" target="_blank" rel="noopener noreferrer" class="yatakari-cta">
							YATAKARIを開く <span class="cta-arrow">↗</span>
						</a>
					</div>
				</div>
			{/if}
		{/each}
	</section>

	<!-- 活動実績 -->
	<div class="gallery-container">
		<div class="mission-head">
			<span class="section-sep"></span>
			<h2 class="section-title">活動実績</h2>
		</div>
		<div class="gallery-scroll-wrap">
			<div class="gallery-images-container">
				{#each company.gallery as image}
					<div class="gallery-item">
						<ImageView modal={imageModalView} src={image} alt={image} />
					</div>
				{/each}
			</div>
		</div>
		<p class="gallery-hint">← スクロールして全て見る →</p>
	</div>

	<ImageModalView bind:this={imageModalView}/>
</main>

<style>
	.company-hero {
		position: relative;
		width: 100%;
		height: 260px;
		background-image: url('/images/shop/yatai.jpg');
		background-size: cover;
		background-position: center;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}
	.company-hero-overlay { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.5); }
	.company-hero-inner { position: relative; z-index: 1; text-align: center; }
	.hero-kicker { display: block; font-size: 0.72rem; letter-spacing: 0.4em; color: #e8c97a; margin-bottom: 8px; }
	.company-hero-title {
		color: #fff; font-size: 2rem; letter-spacing: 0.15em;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5); margin: 0;
		font-family: "Zen Antique", serif;
	}

	main { max-width: 15cm; margin: auto; padding: 0 20px; }

	/* ── ビジョン ── */
	.vision { text-align: center; margin: 3.4rem 0 3rem; }
	.vision-kicker { display: block; font-size: 0.72rem; letter-spacing: 0.32em; color: var(--accent); margin-bottom: 1rem; }
	.vision-lead {
		font-family: "Zen Antique", serif;
		font-size: clamp(1.8rem, 6.5vw, 2.6rem); line-height: 1.4; letter-spacing: 0.04em;
		color: var(--ink); margin: 0 0 1.4rem;
	}
	.vision-body { font-size: 0.95rem; line-height: 2; color: var(--ink-2); max-width: 30rem; margin: 0 auto; }
	.vision-body strong { color: var(--accent-deep); }
	@media (min-width: 560px) { .sp-br { display: none; } }

	/* ── セクション見出し ── */
	.mission-head { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 1.6rem; }
	.section-sep { width: 44px; height: 1px; background: var(--accent); opacity: 0.75; }
	.section-title { font-family: "Zen Antique", serif; font-size: 1.3rem; letter-spacing: 0.12em; color: var(--ink); margin: 0; text-align: center; }

	.mission { margin-bottom: 3.4rem; }
	.mission-body { font-size: 0.92rem; line-height: 1.95; color: var(--ink-2); text-align: justify; margin: 0 0 1.8rem; }

	.pillars { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
	.pillar { display: flex; gap: 14px; align-items: flex-start; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg, 16px); padding: 16px 18px; }
	.pillar-ic { flex-shrink: 0; width: 40px; height: 40px; border-radius: 12px; background: var(--accent-tint); color: var(--accent-deep); display: inline-flex; align-items: center; justify-content: center; }
	.pillar strong { display: block; font-size: 0.95rem; color: var(--ink); margin-bottom: 3px; }
	.pillar p { font-size: 0.82rem; color: var(--ink-2); line-height: 1.6; margin: 0; }

	/* ── 事業内容 ── */
	.businesses { margin-bottom: 3rem; }
	.business-container { margin-bottom: 2rem; }
	.business-name { text-align: center; margin-bottom: 0.6rem; font-family: "Zen Antique", serif; letter-spacing: 0.06em; color: var(--ink); }
	.separator { display: block; background-color: var(--accent); width: 60px; height: 1px; margin: 12px auto 16px; }
	.business-description { font-size: 0.9rem; line-height: 1.9; color: var(--ink-2); text-align: justify; white-space: pre-line; }

	/* ── YATAKARI セクション ── */
	.yatakari-section { margin: 0 0 3rem; background: #1a1410; border-radius: 20px; padding: 32px 28px 28px; color: #fff; }
	.yatakari-header { display: flex; align-items: center; gap: 18px; margin-bottom: 28px; }
	.yatakari-brand {
		flex-shrink: 0; width: 60px; height: 60px; border-radius: 16px;
		background: radial-gradient(circle at 50% 40%, rgba(229,157,60,0.35), rgba(229,157,60,0.06) 70%);
		color: #e8c97a; display: inline-flex; align-items: center; justify-content: center;
		border: 1px solid rgba(232,201,122,0.35);
	}
	.yatakari-title-block { display: flex; flex-direction: column; gap: 3px; }
	.yatakari-label { font-size: 0.72rem; color: #e8c97a; letter-spacing: 0.12em; text-transform: uppercase; }
	.yatakari-title { font-size: 2rem; font-weight: 800; letter-spacing: 0.08em; margin: 0; color: #e8c97a; line-height: 1; }
	.yatakari-subtitle { font-size: 0.82rem; color: #a09080; margin: 0; }

	.service-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
	.service-card { background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(232, 201, 122, 0.2); border-radius: 14px; padding: 16px 12px; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
	.service-icon { color: #e8c97a; display: inline-flex; }
	.service-name { font-size: 0.78rem; font-weight: 700; color: #f0e8d8; line-height: 1.3; }
	.service-desc { font-size: 0.68rem; color: #a09080; line-height: 1.4; }

	.yatakari-cta-wrap { display: flex; justify-content: center; margin-top: 4px; }
	.yatakari-cta { display: inline-flex; align-items: center; gap: 8px; padding: 13px 32px; background: var(--accent); color: #fff; border-radius: 12px; font-size: 0.95rem; font-weight: 700; text-decoration: none; letter-spacing: 0.04em; transition: background 0.15s; white-space: nowrap; }
	.yatakari-cta:hover { background: #b85d03; }
	.cta-arrow { font-size: 1.1rem; }

	@media (max-width: 480px) {
		.service-grid { grid-template-columns: repeat(2, 1fr); }
		.yatakari-title { font-size: 1.6rem; }
	}

	/* ── 活動実績ギャラリー ── */
	.gallery-container { width: 100%; margin-bottom: 3rem; }
	.gallery-scroll-wrap { width: 100vw; margin-left: calc(50% - 50vw); overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
	.gallery-scroll-wrap::-webkit-scrollbar { display: none; }
	.gallery-images-container { display: flex; gap: 10px; padding: 0 max(20px, calc(50% - 7.5cm)) 12px; scroll-snap-type: x mandatory; width: max-content; }
	.gallery-item { flex-shrink: 0; width: min(72vw, 280px); aspect-ratio: 1 / 1; scroll-snap-align: center; border-radius: 6px; overflow: hidden; }
	.gallery-hint { text-align: center; font-size: 0.75rem; color: var(--ink-3); margin: 4px 0 0; }
</style>
