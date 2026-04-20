<script>
	import { base } from '$app/paths';
	import { onDestroy, onMount } from 'svelte';

	let { images } = $props();

	let timer;
	let slideshow_index = $state(0);
	let overlayEl = $state();
	let inTransition = false;

	const FADE_DURATION = 1800; // ms — フェードの長さ

	let current_image = $derived(images[slideshow_index] ?? { src: '', alt: '' });
	let previous_image = $derived(
		images[slideshow_index === 0 ? images.length - 1 : slideshow_index - 1] ?? { src: '', alt: '' }
	);

	function nextSlide() {
		if (inTransition || !overlayEl) return;
		inTransition = true;

		// 1. トランジションなしで即座に非表示（前の画像が下から透けて見える）
		overlayEl.style.transition = 'none';
		overlayEl.style.opacity = '0';

		// 2. スライドを進める
		slideshow_index = (slideshow_index + 1) % images.length;

		// 3. DOM更新後にフェードイン開始
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				overlayEl.style.transition = `opacity ${FADE_DURATION}ms ease-in-out`;
				overlayEl.style.opacity = '1';
				setTimeout(() => { inTransition = false; }, FADE_DURATION);
			});
		});
	}

	onMount(() => {
		if (images.length > 1) {
			timer = setInterval(nextSlide, 6000);
		}
	});

	onDestroy(() => {
		if (timer) clearInterval(timer);
	});
</script>

<div class="slideshow-container">
	<!-- 下レイヤー: 前の画像（常時表示） -->
	<img class="slideshow-image" src={base + previous_image.src} alt={previous_image.alt} />

	<!-- 上レイヤー: 現在の画像（フェードイン/アウト） -->
	<img
		bind:this={overlayEl}
		class="slideshow-image overlay"
		src={base + current_image.src}
		alt={current_image.alt}
	/>
</div>

<style>
	.slideshow-container {
		max-width: 800px;
		width: 100%;
		aspect-ratio: 16 / 9;
		position: relative;
	}

	.slideshow-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		position: absolute;
		clip-path: polygon(0% 40px, 40px 0%, 100% 0px, 100% calc(100% - 40px), calc(100% - 40px) 100%, 0px 100%);
	}

	.overlay {
		z-index: 1;
	}
</style>
