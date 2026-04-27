<script>
	import { base } from '$app/paths';
	import { onDestroy, onMount } from 'svelte';

	let { images } = $props();

	let timer;
	let slideshow_index = $state(0);
	let overlayEl = $state();
	let inTransition = false;

	let touchStartX = 0;

	const FADE_DURATION = 1000;
	const AUTO_INTERVAL = 6000;

	let current_image  = $derived(images[slideshow_index] ?? { src: '', alt: '' });
	let previous_image = $derived(
		images[slideshow_index === 0 ? images.length - 1 : slideshow_index - 1] ?? { src: '', alt: '' }
	);

	function goTo(index) {
		if (inTransition || !overlayEl) return;
		const next = ((index % images.length) + images.length) % images.length;
		if (next === slideshow_index) return;
		inTransition = true;

		overlayEl.style.transition = 'none';
		overlayEl.style.opacity = '0';
		slideshow_index = next;

		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				overlayEl.style.transition = `opacity ${FADE_DURATION}ms ease-in-out`;
				overlayEl.style.opacity = '1';
				setTimeout(() => { inTransition = false; }, FADE_DURATION);
			});
		});
	}

	function nextSlide() { goTo(slideshow_index + 1); }
	function prevSlide() { goTo(slideshow_index - 1); }

	function resetTimer() {
		clearInterval(timer);
		if (images.length > 1) timer = setInterval(nextSlide, AUTO_INTERVAL);
	}

	function handleNext() { nextSlide(); resetTimer(); }
	function handlePrev() { prevSlide(); resetTimer(); }
	function handleDot(i)  { goTo(i);    resetTimer(); }

	function onTouchStart(e) { touchStartX = e.touches[0].clientX; }
	function onTouchEnd(e) {
		const delta = e.changedTouches[0].clientX - touchStartX;
		if (Math.abs(delta) > 40) {
			delta < 0 ? handleNext() : handlePrev();
		}
	}

	onMount(() => {
		if (images.length > 1) timer = setInterval(nextSlide, AUTO_INTERVAL);
	});
	onDestroy(() => { clearInterval(timer); });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="slideshow-wrapper" ontouchstart={onTouchStart} ontouchend={onTouchEnd}>
	<!-- 下レイヤー: 前の画像 -->
	<img class="slideshow-image" src={base + previous_image.src} alt={previous_image.alt} />
	<!-- 上レイヤー: 現在の画像（フェードイン） -->
	<img bind:this={overlayEl} class="slideshow-image overlay"
		src={base + current_image.src} alt={current_image.alt} />

	<!-- 左右矢印（写真上オーバーレイ） -->
	{#if images.length > 1}
		<button class="arrow arrow-prev" onclick={handlePrev} aria-label="前の画像">&#8249;</button>
		<button class="arrow arrow-next" onclick={handleNext} aria-label="次の画像">&#8250;</button>

		<!-- ドット（写真下部オーバーレイ） -->
		<div class="dots">
			{#each images as _, i}
				<button
					class="dot"
					class:active={i === slideshow_index}
					onclick={() => handleDot(i)}
					aria-label={`${i + 1}枚目`}
				></button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.slideshow-wrapper {
		width: 100%;
		height: 100%;
		position: relative;
		user-select: none;
		overflow: hidden;
	}

	.slideshow-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		position: absolute;
		inset: 0;
	}
	.overlay { z-index: 1; }

	/* 矢印: 写真左右にオーバーレイ */
	.arrow {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		z-index: 10;
		background: rgba(0, 0, 0, 0.25);
		color: #fff;
		border: none;
		border-radius: 50%;
		width: 44px;
		height: 44px;
		font-size: 1.6rem;
		line-height: 1;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s;
		backdrop-filter: blur(4px);
	}
	.arrow:hover { background: rgba(0, 0, 0, 0.45); }
	.arrow-prev { left: 16px; }
	.arrow-next { right: 16px; }

	/* ドット: 写真下部オーバーレイ */
	.dots {
		position: absolute;
		bottom: 16px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 10;
		display: flex;
		gap: 8px;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: none;
		background: rgba(255, 255, 255, 0.5);
		cursor: pointer;
		padding: 0;
		transition: background 0.2s, transform 0.2s;
	}
	.dot.active {
		background: #fff;
		transform: scale(1.3);
	}
</style>
