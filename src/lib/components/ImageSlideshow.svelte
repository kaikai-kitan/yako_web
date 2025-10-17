<script>
	import { base } from '$app/paths';
	import { onDestroy, onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	let { images } = $props();

	let timer;
	let slideshow_index = $state(0);
	let fadeImage = $state();

	let current_image = $derived(images[slideshow_index] ?? { src: '', alt: '' });
	let previous_image = $derived(
		images[slideshow_index === 0 ? images.length - 1 : slideshow_index - 1] ?? { src: '', alt: '' }
	);

	function nextSlide() {
		slideshow_index = (slideshow_index + 1) % images.length;
		fadeImage.classList.remove('slideshow-animation');
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				fadeImage.classList.add('slideshow-animation');
			});
		});
	}

	onMount(() => {
		if (images.length > 0) {
			if (timer) {
				clearInterval(timer);
			}
			timer = setInterval(nextSlide, 6000);
		}
	});

	onDestroy(() => {
		if (timer) {
			clearInterval(timer);
		}
	});
</script>

<div class="slideshow-container">
	<!-- Base Image -->
	<img class="slideshow-image" src={base + previous_image.src} alt={previous_image.alt} />

	<!-- Current Image -->
	<img
		bind:this={fadeImage}
		class="slideshow-image slideshow-animation"
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

	.slideshow-animation {
		animation: fade-in 2s;
		animation-direction: normal;
		animation-fill-mode: forwards;
	}

	@keyframes fade-in {
		0% {
			opacity: 0;
		}

		100% {
			opacity: 1;
		}
	}
</style>
