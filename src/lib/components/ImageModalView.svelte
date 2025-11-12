<!-- 画像を拡大表示するモーダル　-->
<script>
	import { fade, scale } from 'svelte/transition';

	let src = $state('');
	let alt = $state('');

	let shown = $state(false);

	export function showImage(_src, _alt) {
		src = _src;
		alt = _alt;
		shown = true;
	}

	function hide() {
		shown = false;
	}
</script>

{#if shown}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div transition:fade={{ duration: 300 }} class="modal-background" onclick={hide}>
		<image transition:scale={{ duration: 300, start: 0.8 }} class="image" {src} {alt} />
	</div>

	<span class="close-button">
		<span class="bar1"></span>
		<span class="bar2"></span>
	</span>
{/if}

<style>
	.modal-background {
		position: fixed;
		top: 0;
		bottom: 0;
		left: 0;
		right: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.image {
		max-width: 90%;
		max-height: 90%;
	}

	.close-button {
		position: fixed;
		top: 50px;
		right: 50px;
		width: 50px;
		height: 50px;
	}

	.close-button .bar1 {
		display: block;
		width: 30px;
		height: 2px;
		background-color: #ffffff;
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translateX(-50%) rotateZ(-45deg);
	}

	.close-button .bar2 {
		display: block;
		width: 30px;
		height: 2px;
		background-color: #ffffff;
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translateX(-50%) rotateZ(45deg);
	}
</style>
