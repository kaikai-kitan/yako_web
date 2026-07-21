<!-- 会社概要（ビジョン → 事業 → 市場規模 → ロードマップ → メンバー → IRニュース） -->
<script>
	import { base } from '$app/paths';
	import company from '$lib/assets/data/company.json';
	import Icon from '$lib/components/Icon.svelte';

	// YATAKARI プラットフォームの機能（絵文字→UIキットのアイコンに統一）
	const services = [
		{ icon: 'map',            name: 'リアルタイムマップ',   desc: '出店中の屋台をマップで確認' },
		{ icon: 'clipboard-list', name: '予約・スペース管理',    desc: '屋台・場所をオンライン予約' },
		{ icon: 'qr-code',        name: 'QR出退店',            desc: 'QRコードで簡単に出退店記録' },
		{ icon: 'shopping-bag',   name: 'オンラインストア',      desc: '店舗商品のEC販売' },
		{ icon: 'package',        name: '在庫管理',            desc: '食材・消耗品の在庫を一元管理' },
		{ icon: 'bar-chart',      name: '収益ダッシュボード',    desc: '売上・精算状況をリアルタイム集計' }
	];

	// 市場規模（京都・予想／年間）
	const market = [
		{ value: '83.6', unit: '億円', label: '京都市 屋台経済効果' },
		{ value: '約102', unit: '万人', label: '京都の屋台利用人口' },
		{ value: '19.6', unit: '億円', label: '京都の屋台総売上' }
	];

	// ロードマップ
	const roadmap = [
		{ year: '2026', phase: 'サービス開始' },
		{ year: '2027', phase: '拡大フェーズ' },
		{ year: '2028', phase: '本格成長' }
	];

	// メンバー
	const members = [
		{
			name: '岩田 快道', kana: 'イワタ カイドウ', mono: '岩',
			from: '滋賀県出身',
			roles: ['プロトタイピング', 'ソフトウェア設計', '資料・ビジネス担当'],
			note: 'シジミ取りで鍛えた足の裏が自慢'
		},
		{
			name: '武藤 太央', kana: 'ムトウ タオ', mono: '武',
			from: '京都出身・京都代表',
			roles: ['コンセプトデザイナー', 'ハードウェア設計', '企画担当'],
			note: '性根はまじめなこだわり派人間'
		}
	];

	// IRニュース（PDF資料をそのまま閲覧）
	const irNews = [
		{
			date: '2026',
			title: '京都屋台化計画 事業計画資料',
			desc: '課題・解決策・市場規模・ロードマップをまとめた事業資料です。',
			pdf: `${base}/ir/microyako-2026.pdf`
		}
	];

	let openPdf = $state(irNews[0]?.pdf ?? '');
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
		<h2 class="vision-lead">京都という文化的な空間を、<br class="sp-br" />より豊かに。</h2>
		<p class="vision-body">
			スマホひとつで、屋台も出店場所もまるごと予約。モノ・場所・ノウハウをパッケージ化した屋台シェアプラットフォーム
			<strong>YATAKARI</strong> で、<strong>“1万円であなたを店主に”</strong>。
			資金・人脈・手続きの壁を取り払い、誰もが挑戦できる街をつくります。
		</p>
	</section>

	<!-- 私たちがすること -->
	<section class="mission">
		<div class="sec-head">
			<span class="section-sep"></span>
			<h2 class="section-title">私たちがすること</h2>
		</div>
		<p class="mission-body">{company.summary}</p>
		<ul class="pillars">
			<li class="pillar">
				<span class="pillar-ic"><Icon name="store" size={22} /></span>
				<div>
					<strong>始めやすさを、屋台で。</strong>
					<p>初期投資や許認可のハードルを下げ、“今日から店主”になれる入口を用意します。</p>
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
		<div class="sec-head">
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

	<!-- 市場規模 -->
	<section class="market">
		<div class="sec-head">
			<span class="section-sep"></span>
			<h2 class="section-title">市場規模</h2>
			<p class="sec-desc">京都・予想／年間</p>
		</div>
		<div class="stat-grid">
			{#each market as m}
				<div class="stat-card">
					<span class="stat-value">{m.value}<span class="stat-unit">{m.unit}</span></span>
					<span class="stat-label">{m.label}</span>
				</div>
			{/each}
		</div>
		<p class="market-note">※ 福岡市の推計手法に基づき、当社にて試算。屋台30軒・主目的率5%を仮定。</p>
	</section>

	<!-- ロードマップ -->
	<section class="roadmap">
		<div class="sec-head">
			<span class="section-sep"></span>
			<h2 class="section-title">ロードマップ</h2>
		</div>
		<ol class="road-steps">
			{#each roadmap as r, i}
				<li class="road-step">
					<span class="road-dot">{i + 1}</span>
					<span class="road-year">{r.year}</span>
					<span class="road-phase">{r.phase}</span>
				</li>
			{/each}
		</ol>
	</section>

	<!-- メンバー -->
	<section class="members">
		<div class="sec-head">
			<span class="section-sep"></span>
			<h2 class="section-title">メンバー</h2>
		</div>
		<div class="member-grid">
			{#each members as p}
				<div class="member-card">
					<div class="member-top">
						<span class="member-mono">{p.mono}</span>
						<div>
							<span class="member-name">{p.name}</span>
							<span class="member-kana">{p.kana}</span>
							<span class="member-from">{p.from}</span>
						</div>
					</div>
					<div class="member-roles">
						{#each p.roles as r}<span class="member-role">{r}</span>{/each}
					</div>
					<p class="member-note">“{p.note}”</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- IRニュース -->
	<section class="ir">
		<div class="sec-head">
			<span class="section-sep"></span>
			<h2 class="section-title">IRニュース</h2>
			<p class="sec-desc">事業資料・お知らせ</p>
		</div>

		<div class="ir-list">
			{#each irNews as n}
				<button class="ir-item" class:active={openPdf === n.pdf} onclick={() => (openPdf = n.pdf)}>
					<span class="ir-ic"><Icon name="clipboard-list" size={20} /></span>
					<span class="ir-text">
						<span class="ir-title">{n.title}</span>
						<span class="ir-desc">{n.desc}</span>
					</span>
					<span class="ir-date">{n.date}</span>
				</button>
			{/each}
		</div>

		{#if openPdf}
			<div class="pdf-frame">
				<iframe src={openPdf} title="IR資料" loading="lazy"></iframe>
			</div>
			<div class="pdf-actions">
				<a class="pdf-open" href={openPdf} target="_blank" rel="external noopener noreferrer">全画面で開く（PDF）↗</a>
				<a class="pdf-dl" href={openPdf} download rel="external">ダウンロード</a>
			</div>
		{/if}
	</section>
</main>

<style>
	.company-hero {
		position: relative; width: 100%; height: 260px;
		background-image: url('/images/shop/yatai.jpg');
		background-size: cover; background-position: center;
		display: flex; align-items: center; justify-content: center; overflow: hidden;
	}
	.company-hero-overlay { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.5); }
	.company-hero-inner { position: relative; z-index: 1; text-align: center; }
	.hero-kicker { display: block; font-size: 0.72rem; letter-spacing: 0.4em; color: #e8c97a; margin-bottom: 8px; }
	.company-hero-title { color: #fff; font-size: 2rem; letter-spacing: 0.15em; text-shadow: 0 2px 8px rgba(0,0,0,0.5); margin: 0; font-family: "Zen Antique", serif; }

	main { max-width: 15cm; margin: auto; padding: 0 20px; }

	/* ── ビジョン ── */
	.vision { text-align: center; margin: 3.4rem 0 3rem; }
	.vision-kicker { display: block; font-size: 0.72rem; letter-spacing: 0.32em; color: var(--accent); margin-bottom: 1rem; }
	.vision-lead { font-family: "Zen Antique", serif; font-size: clamp(1.6rem, 5.6vw, 2.3rem); line-height: 1.45; letter-spacing: 0.03em; color: var(--ink); margin: 0 0 1.4rem; }
	.vision-body { font-size: 0.95rem; line-height: 2; color: var(--ink-2); max-width: 32rem; margin: 0 auto; }
	.vision-body strong { color: var(--accent-deep); }
	@media (min-width: 560px) { .sp-br { display: none; } }

	/* ── 共通セクション見出し ── */
	.sec-head { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 1.6rem; }
	.section-sep { width: 44px; height: 1px; background: var(--accent); opacity: 0.75; }
	.section-title { font-family: "Zen Antique", serif; font-size: 1.3rem; letter-spacing: 0.12em; color: var(--ink); margin: 0; text-align: center; }
	.sec-desc { font-size: 0.78rem; color: var(--ink-3); margin: 0; }

	.mission { margin-bottom: 3.4rem; }
	.mission-body { font-size: 0.92rem; line-height: 1.95; color: var(--ink-2); text-align: justify; margin: 0 0 1.8rem; }
	.pillars { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
	.pillar { display: flex; gap: 14px; align-items: flex-start; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg, 16px); padding: 16px 18px; }
	.pillar-ic { flex-shrink: 0; width: 40px; height: 40px; border-radius: 12px; background: var(--accent-tint); color: var(--accent-deep); display: inline-flex; align-items: center; justify-content: center; }
	.pillar strong { display: block; font-size: 0.95rem; color: var(--ink); margin-bottom: 3px; }
	.pillar p { font-size: 0.82rem; color: var(--ink-2); line-height: 1.6; margin: 0; }

	/* ── 事業内容 ── */
	.businesses { margin-bottom: 3.4rem; }
	.business-container { margin-bottom: 2rem; }
	.business-name { text-align: center; margin-bottom: 0.6rem; font-family: "Zen Antique", serif; letter-spacing: 0.06em; color: var(--ink); }
	.separator { display: block; background-color: var(--accent); width: 60px; height: 1px; margin: 12px auto 16px; }
	.business-description { font-size: 0.9rem; line-height: 1.9; color: var(--ink-2); text-align: justify; white-space: pre-line; }

	/* ── YATAKARI セクション ── */
	.yatakari-section { margin: 0 0 1rem; background: #1a1410; border-radius: 20px; padding: 32px 28px 28px; color: #fff; }
	.yatakari-header { display: flex; align-items: center; gap: 18px; margin-bottom: 28px; }
	.yatakari-brand { flex-shrink: 0; width: 60px; height: 60px; border-radius: 16px; background: radial-gradient(circle at 50% 40%, rgba(229,157,60,0.35), rgba(229,157,60,0.06) 70%); color: #e8c97a; display: inline-flex; align-items: center; justify-content: center; border: 1px solid rgba(232,201,122,0.35); }
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

	/* ── 市場規模 ── */
	.market { margin-bottom: 3.4rem; }
	.stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
	.stat-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg, 16px); padding: 20px 12px; text-align: center; display: flex; flex-direction: column; gap: 6px; }
	.stat-value { font-family: "Zen Antique", serif; font-size: clamp(1.5rem, 6vw, 2rem); font-weight: 800; color: var(--accent-deep); line-height: 1; }
	.stat-unit { font-size: 0.7rem; font-weight: 700; margin-left: 2px; color: var(--ink-2); }
	.stat-label { font-size: 0.72rem; color: var(--ink-2); line-height: 1.4; }
	.market-note { font-size: 0.68rem; color: var(--ink-3); margin: 12px 0 0; line-height: 1.6; }

	/* ── ロードマップ ── */
	.roadmap { margin-bottom: 3.4rem; }
	.road-steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; position: relative; }
	.road-step { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; position: relative; }
	.road-step::before { content: ''; position: absolute; top: 15px; left: -50%; width: 100%; height: 2px; background: var(--line-strong); z-index: 0; }
	.road-step:first-child::before { display: none; }
	.road-dot { position: relative; z-index: 1; width: 30px; height: 30px; border-radius: 50%; background: var(--accent); color: #fff; font-size: 0.8rem; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; }
	.road-year { font-family: "Zen Antique", serif; font-size: 1.05rem; color: var(--ink); }
	.road-phase { font-size: 0.76rem; color: var(--ink-2); }

	/* ── メンバー ── */
	.members { margin-bottom: 3.4rem; }
	.member-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
	.member-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg, 16px); padding: 18px; }
	.member-top { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
	.member-mono { flex-shrink: 0; width: 46px; height: 46px; border-radius: 50%; background: var(--accent-tint); color: var(--accent-deep); font-family: "Zen Antique", serif; font-size: 1.3rem; display: inline-flex; align-items: center; justify-content: center; }
	.member-name { display: block; font-size: 0.98rem; font-weight: 700; color: var(--ink); }
	.member-kana { display: block; font-size: 0.68rem; color: var(--ink-3); letter-spacing: 0.06em; }
	.member-from { display: block; font-size: 0.72rem; color: var(--ink-2); margin-top: 2px; }
	.member-roles { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
	.member-role { font-size: 0.68rem; background: var(--surface-sunk); border: 1px solid var(--line); border-radius: 20px; padding: 3px 10px; color: var(--ink-2); }
	.member-note { font-size: 0.78rem; color: var(--ink-2); font-style: italic; margin: 0; line-height: 1.5; }

	@media (max-width: 480px) {
		.service-grid { grid-template-columns: repeat(2, 1fr); }
		.yatakari-title { font-size: 1.6rem; }
		.member-grid { grid-template-columns: 1fr; }
	}

	/* ── IRニュース ── */
	.ir { margin-bottom: 3.6rem; }
	.ir-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px; }
	.ir-item { display: flex; align-items: center; gap: 14px; width: 100%; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; cursor: pointer; font-family: inherit; transition: border-color 0.15s, background 0.15s; }
	.ir-item:hover { border-color: var(--accent); }
	.ir-item.active { border-color: var(--accent); background: var(--accent-tint); }
	.ir-ic { flex-shrink: 0; width: 38px; height: 38px; border-radius: 10px; background: var(--accent-tint); color: var(--accent-deep); display: inline-flex; align-items: center; justify-content: center; }
	.ir-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
	.ir-title { font-size: 0.9rem; font-weight: 700; color: var(--ink); }
	.ir-desc { font-size: 0.74rem; color: var(--ink-2); line-height: 1.5; }
	.ir-date { font-size: 0.8rem; color: var(--ink-3); font-weight: 600; flex-shrink: 0; }

	.pdf-frame { width: 100%; aspect-ratio: 210 / 297; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--surface-sunk); }
	.pdf-frame iframe { width: 100%; height: 100%; border: 0; display: block; }
	.pdf-actions { display: flex; gap: 12px; justify-content: center; margin-top: 14px; flex-wrap: wrap; }
	.pdf-open { display: inline-block; padding: 10px 22px; background: var(--accent); color: #fff; border-radius: 100px; font-size: 0.88rem; font-weight: 700; text-decoration: none; }
	.pdf-open:hover { background: var(--accent-deep); }
	.pdf-dl { display: inline-block; padding: 10px 22px; border: 1px solid var(--line-strong); color: var(--ink); border-radius: 100px; font-size: 0.88rem; font-weight: 600; text-decoration: none; }
	.pdf-dl:hover { border-color: var(--accent); color: var(--accent); }
</style>
