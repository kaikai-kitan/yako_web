<!-- スプラッシュ -->
<script>
	import { fade, blur } from 'svelte/transition';

	let visible_splash = $state(false);

	/**
	 * 画面にスプラッシュを表示する
	 */
	export function showSplash() {
		visible_splash = true;
		setTimeout(() => {
			visible_splash = false;
			window.scroll(0, 0);
		}, 4500);
	}
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link href="https://fonts.googleapis.com/css2?family=Kaisei+Opti&display=swap" rel="stylesheet">
</svelte:head>

{#if visible_splash}
	<div out:fade class="splash-background">
		<div class="splash-container display-font">
			<p in:blur={{duration: 2000}} class="catch_phrase">世界は常に夜なのよ</p>
			<p in:blur={{duration: 2000, delay: 2000}} class="catch_phrase">我々はただ歩いて行くだけ。</p>
		</div>
	</div>
{/if}

<style>
	.splash-background {
		display: block;
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: #fbf3ea;
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.splash-container {
		text-align: center;
		writing-mode: vertical-rl;
	}

	.catch_phrase {
		color: #26201a;
		font-size: 2em; /* フォントサイズを元の大きさに戻す */
		font-family: "Kaisei Opti", serif;
		font-weight: 400;
		font-style: normal;
		margin: 0;
		white-space: nowrap;
		user-select: none;
	}
</style>
