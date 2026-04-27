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
<div class="slideshow-outer">
	<!-- 画像フレーム（手紙カット） -->
	<div class="slideshow-frame" ontouchstart={onTouchStart} ontouchend={onTouchEnd}>
		<img class="slideshow-image" src={base + previous_image.src} alt={previous_image.alt} />
		<img bind:this={overlayEl} class="slideshow-image overlay"
			src={base + current_image.src} alt={current_image.alt} />
	</div>

	<!-- ドット（写真枚数インジケーター） -->
	{#if images.length > 1}
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
	.slideshow-outer {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 10px;
	}

	/* 手紙カット形状のフレーム */
	.slideshow-frame {
		width: 100%;
		aspect-ratio: 3 / 2;
		position: relative;
		overflow: hidden;
		user-select: none;
		/* 左上・右下を手紙のように斜めカット */
		clip-path: polygon(
			0% 60px, 60px 0%,
			100% 0%,
			100% calc(100% - 60px), calc(100% - 60px) 100%,
			0% 100%
		);
	}

	.slideshow-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		position: absolute;
		inset: 0;
	}
	.overlay { z-index: 1; }

	.dots { display: flex; gap: 7px; justify-content: center; }
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: none;
		background: #c8bfb5;
		cursor: pointer;
		padding: 0;
		transition: background 0.2s, transform 0.2s;
	}
	.dot.active { background: #26201a; transform: scale(1.3); }
</style>
