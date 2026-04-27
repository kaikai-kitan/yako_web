<!-- 事業内容 -->
<script>
	import company from '$lib/assets/data/company.json';
	import ImageModalView from '$lib/components/ImageModalView.svelte';
	import ImageView from '$lib/components/ImageView.svelte';

	let imageModalView = $state();
</script>

<div class="company-hero">
	<div class="company-hero-overlay"></div>
	<h1 class="company-hero-title">事業内容</h1>
</div>

<main>
	<div class="summary-container">
		<p class="summary">{company.summary}</p>
	</div>

	{#each company.businesses as business}
		<div class="business-container">
			<h2 class="business-name">{business.name}</h2>
			<span class="separator"></span>
			<p class="business-description">{business.description}</p>
		</div>

		{#if business.name === '京産屋台化計画'}
			<!-- YATAKARI サービス紹介 -->
			<div class="yatakari-section">
				<div class="yatakari-header">
					<span class="yatakari-lantern">🏮</span>
					<div class="yatakari-title-block">
						<span class="yatakari-label">デジタル基盤</span>
						<h3 class="yatakari-title">YATAKARI</h3>
						<p class="yatakari-subtitle">屋台出店をワンストップで支援するプラットフォーム</p>
					</div>
				</div>

				<div class="service-grid">
					<div class="service-card">
						<span class="service-icon">🗺️</span>
						<span class="service-name">リアルタイムマップ</span>
						<span class="service-desc">出店中の屋台をマップで確認</span>
					</div>
					<div class="service-card">
						<span class="service-icon">📅</span>
						<span class="service-name">予約・スペース管理</span>
						<span class="service-desc">屋台・場所をオンライン予約</span>
					</div>
					<div class="service-card">
						<span class="service-icon">📱</span>
						<span class="service-name">QR出退店</span>
						<span class="service-desc">QRコードで簡単に出退店記録</span>
					</div>
					<div class="service-card">
						<span class="service-icon">🛍️</span>
						<span class="service-name">オンラインショップ</span>
						<span class="service-desc">店舗商品のEC販売</span>
					</div>
					<div class="service-card">
						<span class="service-icon">📦</span>
						<span class="service-name">在庫管理</span>
						<span class="service-desc">食材・消耗品の在庫を一元管理</span>
					</div>
					<div class="service-card">
						<span class="service-icon">📊</span>
						<span class="service-name">収益ダッシュボード</span>
						<span class="service-desc">売上・精算状況をリアルタイム集計</span>
					</div>
				</div>

				<a href="/yatakari" target="_blank" rel="noopener noreferrer" class="yatakari-cta">
					YATAKARIを開く <span class="cta-arrow">↗</span>
				</a>
			</div>
		{/if}
	{/each}

	<div class="gallery-container">
		<h1 class="gallery-name">活動実績ギャラリー</h1>
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

	.company-hero-overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
	}

	.company-hero-title {
		position: relative;
		z-index: 1;
		color: #fff;
		font-size: 2rem;
		letter-spacing: 0.15em;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
		margin: 0;
	}

	main {
		max-width: 15cm;
		margin: auto;
		padding: 0 20px;
	}

	.summary-container {
		margin-top: 2.5rem;
		margin-bottom: 3rem;
	}

	.business-container {
		margin-bottom: 2rem;
	}

	.business-name {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	.separator {
		display: block;
		background-color: #d56d04;
		width: 60px;
		height: 1px;
		margin: 16px 0;
	}

	/* YATAKARI セクション */
	.yatakari-section {
		margin: 0 0 3rem;
		background: #1a1410;
		border-radius: 20px;
		padding: 32px 28px 28px;
		color: #fff;
	}

	.yatakari-header {
		display: flex;
		align-items: center;
		gap: 18px;
		margin-bottom: 28px;
	}

	.yatakari-lantern {
		font-size: 3rem;
		flex-shrink: 0;
		filter: drop-shadow(0 0 12px rgba(229, 157, 60, 0.6));
	}

	.yatakari-title-block {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.yatakari-label {
		font-size: 0.72rem;
		color: #e8c97a;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.yatakari-title {
		font-size: 2rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		margin: 0;
		color: #e8c97a;
		line-height: 1;
	}

	.yatakari-subtitle {
		font-size: 0.82rem;
		color: #a09080;
		margin: 0;
	}

	.service-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
		margin-bottom: 24px;
	}

	.service-card {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(232, 201, 122, 0.2);
		border-radius: 14px;
		padding: 16px 12px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		text-align: center;
	}

	.service-icon {
		font-size: 2rem;
	}

	.service-name {
		font-size: 0.78rem;
		font-weight: 700;
		color: #f0e8d8;
		line-height: 1.3;
	}

	.service-desc {
		font-size: 0.68rem;
		color: #7a6f67;
		line-height: 1.4;
	}

	.yatakari-cta {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 13px;
		background: #d56d04;
		color: #fff;
		border-radius: 12px;
		font-size: 0.95rem;
		font-weight: 700;
		text-decoration: none;
		letter-spacing: 0.04em;
		transition: background 0.15s;
	}

	.yatakari-cta:hover { background: #b85d03; }
	.cta-arrow { font-size: 1.1rem; }

	@media (max-width: 480px) {
		.service-grid { grid-template-columns: repeat(2, 1fr); }
		.yatakari-title { font-size: 1.6rem; }
	}

	.gallery-container {
		width: 100%;
	}

	.gallery-name {
    text-align: center;
		margin-bottom: 3rem;
	}

	/* ギャラリー横スクロール */
	.gallery-scroll-wrap {
		width: 100vw;
		margin-left: calc(50% - 50vw);
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none; /* Firefox */
	}
	.gallery-scroll-wrap::-webkit-scrollbar { display: none; }

	.gallery-images-container {
		display: flex;
		gap: 10px;
		padding: 0 max(20px, calc(50% - 7.5cm)) 12px;
		scroll-snap-type: x mandatory;
		width: max-content;
	}

	.gallery-item {
		flex-shrink: 0;
		width: min(72vw, 280px);
		aspect-ratio: 1 / 1;
		scroll-snap-align: center;
		border-radius: 6px;
		overflow: hidden;
	}

	.gallery-hint {
		text-align: center;
		font-size: 0.75rem;
		color: #9e9289;
		margin: 4px 0 0;
	}
</style>
