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
		<div class="lantern">🏮</div>
		<h1 class="title">YATAKARI</h1>
		<p class="subtitle">屋台シェアリングプラットフォーム</p>
		<div class="loading-bar">
			<div class="loading-fill"></div>
		</div>
		<p class="loading-text">YATAI 読み込み中<span class="dots"><span>.</span><span>.</span><span>.</span></span></p>
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

	.lantern {
		font-size: 4rem;
		animation: swing 1.8s ease-in-out infinite;
		transform-origin: top center;
	}

	@keyframes swing {
		0%,100% { transform: rotate(-8deg); }
		50%      { transform: rotate(8deg); }
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
		background: linear-gradient(90deg, #f5c842, #d56d04);
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
		color: #d56d04;
	}
	.dots span:nth-child(2) { animation-delay: 0.2s; }
	.dots span:nth-child(3) { animation-delay: 0.4s; }

	@keyframes blink {
		0%,80%,100% { opacity: 0.2; }
		40%          { opacity: 1; }
	}
</style>
