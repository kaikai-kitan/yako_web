<!-- 会社概要（ビジョン → 事業 → 市場規模 → ロードマップ → メンバー → IRニュース） -->
<script>
	import { base } from '$app/paths';
	import company from '$lib/assets/data/company.json';
	import Icon from '$lib/components/Icon.svelte';

	// 事業ごとの関係性ビジュアル（名前をキーに company.json の説明へ重ねる）
	const bizVisual = {
		'京産屋台化計画': {
			concept: '1万円で、あなたを社長に。',
			flow: {
				from: [
					{ icon: 'map-pin',        label: '場所' },
					{ icon: 'clipboard-list', label: 'ノウハウ' },
					{ icon: 'landmark',       label: 'コスト' }
				],
				fromCaption: '起業の三大ハードル',
				arrow: '取り払う',
				to: { icon: 'store', label: '今日から店主' }
			},
			features: [
				{ icon: 'yatai',            label: '屋台の貸出' },
				{ icon: 'utensils-crossed', label: '仕込み場所' },
				{ icon: 'package',          label: '資材の保管' },
				{ icon: 'badge-check',      label: '許可申請サポート' }
			]
		},
		'鴨川屋台特区': {
			concept: '眠る場所を、日替わりの屋台村へ。',
			flow: {
				from: [ { icon: 'map-pin', label: '空き地・空き時間' } ],
				fromCaption: '鴨川周辺に眠る余白を',
				arrow: '束ねる',
				to: { icon: 'yatai', label: '常設の屋台村' }
			},
			features: [
				{ icon: 'landmark',  label: '定額でシェア' },
				{ icon: 'user',      label: '小資本でも挑戦' },
				{ icon: 'handshake', label: '土地の斡旋' },
				{ icon: 'store',     label: '自社出店' }
			]
		}
	};

	// ロードマップ（IR資料の成長アイコンでビジュアル化）
	const roadmap = [
		{ year: '2026', phase: 'サービス開始', icon: 'sprout' },
		{ year: '2027', phase: '拡大フェーズ', icon: 'leaf' },
		{ year: '2028', phase: '本格成長',   icon: 'trees' }
	];

	// IRニュース（Web で開ける PDF リンク）
	const irNews = [
		{
			date: '2026',
			title: '京都屋台化計画 事業計画資料',
			desc: '課題・解決策・市場規模・ロードマップをまとめた事業資料です。',
			pdf: `${base}/ir/microyako-2026.pdf`
		}
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
		<h2 class="vision-lead">京都という文化的な空間を、より豊かに。</h2>
		<p class="vision-body">
			スマホひとつで、屋台も出店場所もまるごと予約。モノ・場所・ノウハウをパッケージ化した屋台シェアプラットフォーム<span class="em">YATAKARI</span>で、<span class="em">「1万円であなたを店主に」</span>。資金・人脈・手続きの壁を取り払い、誰もが挑戦できる街をつくります。
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
					<span class="pillar-title">始めやすさを、屋台で。</span>
					<p>初期投資や許認可のハードルを下げ、今日から店主になれる入口を用意します。</p>
				</div>
			</li>
			<li class="pillar">
				<span class="pillar-ic"><Icon name="map-pin" size={22} /></span>
				<div>
					<span class="pillar-title">京都の夜に、賑わいを。</span>
					<p>鴨川周辺の空き地・空き時間を束ね、日替わりの屋台村として街に灯りをともします。</p>
				</div>
			</li>
			<li class="pillar">
				<span class="pillar-ic"><Icon name="handshake" size={22} /></span>
				<div>
					<span class="pillar-title">出会いを、夜の人脈に。</span>
					<p>屋台での一夜の出会いを「夜行人ネットワーク」としてつなぎ、挑戦者どうしの縁を育てます。</p>
				</div>
			</li>
		</ul>
	</section>

	<!-- 事業内容（2つのプロジェクトをステップで関係づける） -->
	<section class="businesses">
		<div class="sec-head">
			<span class="section-sep"></span>
			<h2 class="section-title">事業内容</h2>
			<p class="sec-desc">2つのプロジェクトで、京都の夜をつくる</p>
		</div>

		<ol class="steps">
			{#each company.businesses as business, i}
				{@const v = bizVisual[business.name]}
				<li class="step" class:step-future={!v}>
					<div class="step-head">
						<span class="step-no">STEP {String(i + 1).padStart(2, '0')}</span>
						<h3 class="step-name">{business.name}</h3>
						{#if v}<span class="step-concept">{v.concept}</span>{/if}
					</div>

					<p class="step-body">{business.description}</p>

					{#if v}
						<!-- 関係性の図：入力 →（変換）→ 成果 -->
						<div class="flow">
							<div class="flow-side">
								<div class="flow-nodes">
									{#each v.flow.from as f}
										<span class="flow-node">
											<span class="flow-ic"><Icon name={f.icon} size={20} /></span>
											<span class="flow-label">{f.label}</span>
										</span>
									{/each}
								</div>
								<span class="flow-caption">{v.flow.fromCaption}</span>
							</div>
							<div class="flow-arrow">
								<span class="flow-arrow-line" aria-hidden="true"></span>
								<span class="flow-arrow-text">{v.flow.arrow}</span>
							</div>
							<div class="flow-side">
								<span class="flow-node flow-node--goal">
									<span class="flow-ic"><Icon name={v.flow.to.icon} size={22} /></span>
									<span class="flow-label">{v.flow.to.label}</span>
								</span>
							</div>
						</div>

						<!-- 提供する要素 -->
						<div class="feat-row">
							{#each v.features as f}
								<span class="feat">
									<span class="feat-ic"><Icon name={f.icon} size={18} /></span>
									<span class="feat-label">{f.label}</span>
								</span>
							{/each}
						</div>
					{:else}
						<span class="step-tag">構想中</span>
					{/if}
				</li>
			{/each}
		</ol>
	</section>

	<!-- ロードマップ（成長アイコンでビジュアル化） -->
	<section class="roadmap">
		<div class="sec-head">
			<span class="section-sep"></span>
			<h2 class="section-title">ロードマップ</h2>
			<p class="sec-desc">小さな灯りを、大きな賑わいへ</p>
		</div>
		<ol class="road-steps">
			{#each roadmap as r}
				<li class="road-step">
					<span class="road-dot"><Icon name={r.icon} size={26} /></span>
					<span class="road-year">{r.year}</span>
					<span class="road-phase">{r.phase}</span>
				</li>
			{/each}
		</ol>
	</section>

	<!-- IRニュース（Web で開ける PDF リンク） -->
	<section class="ir">
		<div class="sec-head">
			<span class="section-sep"></span>
			<h2 class="section-title">IRニュース</h2>
			<p class="sec-desc">事業資料・お知らせ</p>
		</div>

		<div class="ir-list">
			{#each irNews as n}
				<a class="ir-item" href={n.pdf} target="_blank" rel="external noopener noreferrer">
					<span class="ir-ic"><Icon name="clipboard-list" size={20} /></span>
					<span class="ir-text">
						<span class="ir-title">{n.title}</span>
						<span class="ir-desc">{n.desc}</span>
					</span>
					<span class="ir-open">PDFを開く ↗</span>
				</a>
			{/each}
		</div>
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
	.vision-lead { font-family: "Zen Antique", serif; font-size: clamp(1.5rem, 5.2vw, 2.3rem); line-height: 1.5; letter-spacing: 0.03em; color: var(--ink); margin: 0 0 1.4rem; text-wrap: balance; }
	.vision-body { font-size: 0.95rem; line-height: 2; color: var(--ink-2); max-width: 32rem; margin: 0 auto; text-wrap: pretty; }
	.vision-body .em { color: var(--accent-deep); }

	/* ── 共通セクション見出し ── */
	.sec-head { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 1.6rem; }
	.section-sep { width: 44px; height: 1px; background: var(--accent); opacity: 0.75; }
	.section-title { font-family: "Zen Antique", serif; font-size: 1.3rem; letter-spacing: 0.12em; color: var(--ink); margin: 0; text-align: center; }
	.sec-desc { font-size: 0.78rem; color: var(--ink-3); margin: 0; }

	.mission { margin-bottom: 3.4rem; }
	.mission-body { font-size: 0.92rem; line-height: 1.95; color: var(--ink-2); margin: 0 0 1.8rem; text-wrap: pretty; }
	.pillars { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
	.pillar { display: flex; gap: 14px; align-items: flex-start; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg, 16px); padding: 16px 18px; }
	.pillar-ic { flex-shrink: 0; width: 40px; height: 40px; border-radius: 12px; background: var(--accent-tint); color: var(--accent-deep); display: inline-flex; align-items: center; justify-content: center; }
	.pillar-title { display: block; font-size: 0.95rem; font-weight: 600; color: var(--ink); margin-bottom: 3px; }
	.pillar p { font-size: 0.82rem; color: var(--ink-2); line-height: 1.6; margin: 0; text-wrap: pretty; }

	/* ── 事業内容（ステップ＋関係図） ── */
	.businesses { margin-bottom: 3.4rem; }
	.steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0; }
	.step { position: relative; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg, 16px); padding: 22px 20px; }
	/* ステップ間の縦の連結線（関係性を示す） */
	.step + .step { margin-top: 40px; }
	.step + .step::before {
		content: ''; position: absolute; top: -34px; left: 50%; transform: translateX(-50%);
		width: 2px; height: 30px; background: var(--line-strong);
	}
	.step + .step::after {
		content: ''; position: absolute; top: -10px; left: 50%; transform: translate(-50%, -50%) rotate(45deg);
		width: 8px; height: 8px; border-right: 2px solid var(--line-strong); border-bottom: 2px solid var(--line-strong);
	}
	.step-head { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; margin-bottom: 14px; }
	.step-no { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.16em; color: var(--accent); }
	.step-name { font-family: "Zen Antique", serif; font-size: 1.15rem; letter-spacing: 0.06em; color: var(--ink); margin: 0; }
	.step-concept { font-size: 0.82rem; color: var(--accent-deep); }
	.step-body { font-size: 0.88rem; line-height: 1.9; color: var(--ink-2); margin: 0 0 18px; text-wrap: pretty; white-space: pre-line; }

	/* 関係図：入力群 →（変換）→ 成果 */
	.flow { display: flex; flex-direction: column; align-items: center; gap: 0; background: var(--surface-sunk); border-radius: 14px; padding: 18px 14px; margin-bottom: 16px; }
	.flow-side { display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%; }
	.flow-nodes { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
	.flow-node { display: flex; flex-direction: column; align-items: center; gap: 5px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; min-width: 74px; }
	.flow-ic { color: var(--accent-deep); display: inline-flex; }
	.flow-label { font-size: 0.72rem; font-weight: 600; color: var(--ink); text-align: center; line-height: 1.3; }
	.flow-node--goal { border-color: var(--accent); background: var(--accent-tint); min-width: 92px; padding: 12px 16px; }
	.flow-node--goal .flow-label { color: var(--accent-deep); }
	.flow-caption { font-size: 0.72rem; color: var(--ink-3); }
	.flow-arrow { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 0; }
	.flow-arrow-line { width: 2px; height: 16px; background: var(--accent); position: relative; }
	.flow-arrow-line::after { content: ''; position: absolute; bottom: -4px; left: 50%; transform: translate(-50%, 0) rotate(45deg); width: 7px; height: 7px; border-right: 2px solid var(--accent); border-bottom: 2px solid var(--accent); }
	.flow-arrow-text { font-size: 0.72rem; font-weight: 700; color: var(--accent); }

	/* 提供要素チップ */
	.feat-row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
	.feat { display: inline-flex; align-items: center; gap: 6px; background: var(--surface-sunk); border: 1px solid var(--line); border-radius: 100px; padding: 6px 12px; }
	.feat-ic { color: var(--accent-deep); display: inline-flex; }
	.feat-label { font-size: 0.74rem; color: var(--ink-2); }

	/* 構想中ステップ */
	.step-future { border-style: dashed; background: transparent; }
	.step-tag { display: inline-block; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em; color: var(--ink-3); background: var(--surface-sunk); border: 1px solid var(--line); border-radius: 100px; padding: 4px 12px; }

	@media (min-width: 560px) {
		.flow { flex-direction: row; justify-content: center; gap: 4px; }
		.flow-side { width: auto; }
		.flow-arrow { padding: 0 6px; }
		.flow-arrow-line { width: 22px; height: 2px; }
		.flow-arrow-line::after { bottom: 50%; left: auto; right: -4px; transform: translate(0, 50%) rotate(-45deg); }
	}

	/* ── ロードマップ（成長アイコン） ── */
	.roadmap { margin-bottom: 3.4rem; }
	.road-steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; position: relative; }
	.road-step { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; position: relative; }
	.road-step::before { content: ''; position: absolute; top: 27px; left: -50%; width: 100%; height: 2px; background: var(--line-strong); z-index: 0; }
	.road-step:first-child::before { display: none; }
	.road-dot { position: relative; z-index: 1; width: 54px; height: 54px; border-radius: 50%; background: var(--surface); border: 2px solid var(--accent); color: var(--accent-deep); display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px rgba(184, 92, 43, 0.14); }
	.road-year { font-family: "Zen Antique", serif; font-size: 1.05rem; color: var(--ink); }
	.road-phase { font-size: 0.76rem; color: var(--ink-2); }

	/* ── IRニュース ── */
	.ir { margin-bottom: 3.6rem; }
	.ir-list { display: flex; flex-direction: column; gap: 10px; }
	.ir-item { display: flex; align-items: center; gap: 14px; width: 100%; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; text-decoration: none; transition: border-color 0.15s, background 0.15s; }
	.ir-item:hover { border-color: var(--accent); background: var(--accent-tint); }
	.ir-ic { flex-shrink: 0; width: 38px; height: 38px; border-radius: 10px; background: var(--accent-tint); color: var(--accent-deep); display: inline-flex; align-items: center; justify-content: center; }
	.ir-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
	.ir-title { font-size: 0.9rem; font-weight: 700; color: var(--ink); }
	.ir-desc { font-size: 0.74rem; color: var(--ink-2); line-height: 1.5; text-wrap: pretty; }
	.ir-open { font-size: 0.78rem; font-weight: 700; color: var(--accent); flex-shrink: 0; white-space: nowrap; }
</style>
