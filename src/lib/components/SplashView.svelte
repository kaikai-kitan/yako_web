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

{#if visible_splash}
	<div out:fade class="splash-background">
		<div class="splash-container display-font">
			<p in:blur={{duration: 2000}} class="catch_phrase">小さな屋台の灯りに集い</p>
			<p in:blur={{duration: 2000, delay: 2000}} class="catch_phrase">夜を乗り越えて行きましょう。</p>
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
		font-weight: bold;
		margin: 0;
		white-space: nowrap;
		user-select: none;
	}
</style>
