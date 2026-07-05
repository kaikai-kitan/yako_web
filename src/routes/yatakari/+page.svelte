<svelte:head>
	<title>YATAKARI 読み込み中...</title>
</svelte:head>

<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';

	let phase = $state('loading'); // 'loading' | 'ready'

	onMount(() => {
		// 2秒後にマップへ遷移
		const timer = setTimeout(() => {
			phase = 'ready';
			setTimeout(() => goto(`${base}/map`), 500);
		}, 2000);
		return () => clearTimeout(timer);
	});
</script>

<div class="splash" class:fade-out={phase === 'ready'}>
	<div class="inner">
		<div class="stage">
			<img class="cart" src="{base}/images/yatakari_cart_gold.png" alt="屋台" />
			<div class="shadow"></div>
			<div class="road"></div>
		</div>
		<h1 class="title">YATAKARI</h1>
		<p class="subtitle">屋台シェアリングプラットフォーム</p>
		<div class="loading-bar">
			<div class="loading-fill"></div>
		</div>
		<p class="loading-text">屋台を運んでいます<span class="dots"><span>.</span><span>.</span><span>.</span></span></p>
	</div>
</div>

<style>
	.splash {
		position: fixed;
		inset: 0;
		background: #1a1208;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
		transition: opacity 0.5s ease;
	}
	.splash.fade-out {
		opacity: 0;
		pointer-events: none;
	}

	.inner {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		animation: rise 0.6s ease both;
	}

	@keyframes rise {
		from { opacity: 0; transform: translateY(20px); }
		to   { opacity: 1; transform: translateY(0); }
	}

	/* ── 屋台を運ぶステージ ── */
	.stage {
		position: relative;
		width: 140px;
		height: 128px;
		margin-bottom: 8px;
	}

	/* 屋台本体：4コマの「運んでいる」ホップ（各コマを保持してパラパラ漫画風に） */
	.cart {
		position: absolute;
		left: 50%;
		bottom: 14px;
		width: 108px;
		height: auto;
		margin-left: -54px;
		transform-origin: 50% 90%;
		animation: cart-hop 1.1s steps(1, end) infinite;
		filter: drop-shadow(0 0 10px rgba(245, 200, 66, 0.28));
	}

	@keyframes cart-hop {
		0%,   24% { transform: translateY(0)     rotate(-3deg); }  /* コマ1：着地・左傾き */
		25%,  49% { transform: translateY(-12px) rotate(0deg); }   /* コマ2：持ち上げ */
		50%,  74% { transform: translateY(0)     rotate(3deg); }   /* コマ3：着地・右傾き */
		75%,  99% { transform: translateY(-12px) rotate(0deg); }   /* コマ4：持ち上げ */
	}

	/* 接地影：ホップと同期して伸縮 */
	.shadow {
		position: absolute;
		left: 50%;
		bottom: 8px;
		width: 78px;
		height: 12px;
		margin-left: -39px;
		background: radial-gradient(ellipse at center, rgba(0,0,0,0.5), rgba(0,0,0,0) 70%);
		border-radius: 50%;
		animation: shadow-pulse 1.1s steps(1, end) infinite;
	}

	@keyframes shadow-pulse {
		0%,   24% { transform: scaleX(1);    opacity: 0.55; }
		25%,  49% { transform: scaleX(0.72); opacity: 0.3;  }
		50%,  74% { transform: scaleX(1);    opacity: 0.55; }
		75%,  99% { transform: scaleX(0.72); opacity: 0.3;  }
	}

	/* 夜道：破線が右へ流れて「前進している」感を出す */
	.road {
		position: absolute;
		left: -20px;
		right: -20px;
		bottom: 6px;
		height: 2px;
		background-image: linear-gradient(90deg, var(--accent) 0 14px, transparent 14px 30px);
		background-size: 30px 2px;
		background-repeat: repeat-x;
		opacity: 0.35;
		-webkit-mask-image: linear-gradient(90deg, transparent, #000 20%, #000 80%, transparent);
		mask-image: linear-gradient(90deg, transparent, #000 20%, #000 80%, transparent);
		animation: road-flow 0.55s linear infinite;
	}

	@keyframes road-flow {
		from { background-position: 0 0; }
		to   { background-position: -30px 0; }
	}

	@media (prefers-reduced-motion: reduce) {
		.cart, .shadow, .road { animation: none; }
		.cart { transform: translateY(-4px); }
	}

	.title {
		font-size: 2rem;
		font-weight: 800;
		color: #f5c842;
		letter-spacing: 0.12em;
		margin: 0;
	}

	.subtitle {
		font-size: 0.85rem;
		color: #a08060;
		margin: 0;
		letter-spacing: 0.06em;
	}

	.loading-bar {
		width: 200px;
		height: 3px;
		background: #3a2e1e;
		border-radius: 2px;
		margin-top: 20px;
		overflow: hidden;
	}
	.loading-fill {
		height: 100%;
		background: linear-gradient(90deg, #f5c842, var(--accent));
		border-radius: 2px;
		animation: fill 2s ease forwards;
	}
	@keyframes fill {
		from { width: 0%; }
		to   { width: 100%; }
	}

	.loading-text {
		font-size: 0.8rem;
		color: #7a6050;
		margin: 0;
		letter-spacing: 0.04em;
	}

	.dots span {
		display: inline-block;
		animation: blink 1.2s infinite;
		color: var(--accent);
	}
	.dots span:nth-child(2) { animation-delay: 0.2s; }
	.dots span:nth-child(3) { animation-delay: 0.4s; }

	@keyframes blink {
		0%,80%,100% { opacity: 0.2; }
		40%          { opacity: 1; }
	}
</style>
