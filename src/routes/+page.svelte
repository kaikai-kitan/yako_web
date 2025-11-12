<!-- メインページ -->
<script>
	import ImageSlideshow from '$lib/components/ImageSlideshow.svelte';
	import SplashView from '$lib/components/SplashView.svelte';
	import { onMount } from 'svelte';

	import homeData from '$lib/assets/data/home.json';
	import ReservationForm from '$lib/components/ReservationForm.svelte';

	let splash = $state();

	let gallery;
	let phrase1;
	let phrase2;
	let phrase3;

	function showSplashInNecessary() {
		const noSplashExpirationKey = 'no_splash_expiration_key';
		const noSplashExpirationValue = localStorage.getItem(noSplashExpirationKey);

		// localStorage にキーが存在しなかったら
		if (noSplashExpirationValue !== null) {
			// localStorage に存在する期限を超過しているなら実行
			if (noSplashExpirationValue > Date.now()) {
				return;
			}
		}

		splash.showSplash();
		const nextExpiration = Date.now() + (24 * 60 * 60 * 1000);
		localStorage.setItem(noSplashExpirationKey, nextExpiration);
	}

	function onScrollGallery() {
		function updateStyle(rate, element) {
			const opacity = `${rate}`;
			const blur = `blur(${(1 - rate) * 10}px)`;

			element.style["opacity"] = opacity;
			element.style["filter"] = blur;
		}
		
		const maskRect = gallery.getBoundingClientRect();
		[phrase1, phrase2, phrase3].forEach(phrase => {
			const phraseRect = phrase.getBoundingClientRect();

			const maskCenterY = maskRect.y + maskRect.height / 2;
			const phraseCenterY = phraseRect.y + phraseRect.height / 2;
			const maskHeight = Math.pow(maskRect.height, 2) / 10;
			const delta = Math.pow(phraseCenterY - maskCenterY, 2) / maskHeight;
			const rate = 1 - Math.min(1, delta / 5);
			updateStyle(rate, phrase);
		});
	}

	onMount(() => {
		showSplashInNecessary();
		onScrollGallery();
	});

</script>

<SplashView bind:this={splash} />

<main>
	<div class="top-gallery-mask" bind:this={gallery} onscroll={onScrollGallery}>
		<div class="top-gallery">
			<div class="slideshow-container">
				<div class="slideshow">
					<ImageSlideshow images={homeData.images} />
				</div>
			</div>
			<div class="description-container">
				<div class="phrase-container phrase-1" bind:this={phrase1}>
					<span class="description-text">微小夜行電灯</span>
				</div>
				<div class="phrase-container phrase-2" bind:this={phrase2}>
					<span class="description-text">京都に流れる鴨川の河川敷で </span>
					<span class="description-text">ゆったりとした時間を過ごせる </span>
				</div>
				<div class="phrase-container phrase-3" bind:this={phrase3}>
					<span class="description-text">
						<strong>おもろい空間</strong>を作りたいと思い、
					</span>
					<span class="description-text">京都府を中心に活動をする夜行人です </span>
				</div>
			</div>
		</div>
	</div>

	<div class="messages-container">

	</div>

	<ReservationForm />
</main>

<style>
	main {
		width: 100%;
		box-sizing: border-box;
	}

	.top-gallery-mask {
		width: 100%;
		height: 600px;
		overflow: scroll;
		scrollbar-width: 0;
	}

	.top-gallery-mask::-webkit-scrollbar {
		display: none;
	}

	.top-gallery {
		display: flex;
		position: relative;
		justify-content: center;
		column-gap: 40px;
	}

	.slideshow-container {
		flex-grow: 1;
		width: 100%;
		max-width: 800px;
		height: 1600px;
	}

	.slideshow {
		position: sticky;
		top: 10%;
	}

	.phrase-container {
		position: relative;
		width: 80%;
		margin: auto;
		display: flex;
		gap: 1rem;
	}

	.description-container {
		position: absolute;
		width: 100%;
		max-width: 800px;
		height: 1800px;
		flex-grow: 1;
		overflow: hidden;
	}

	.phrase-1 {
		top: 200px;
		justify-content: flex-start;
	}

	.phrase-2 {
		top: 250px;
		justify-content: flex-end;
	}

	.phrase-3 {
		top: 300px;
		justify-content: flex-start;
	}

	.description-text {
		writing-mode: vertical-lr;
		font-size: 20px;
		text-align: center;
		padding: 30px 2px;
		background-color: #ffffff;
		box-shadow: 0 10px 10px rgba(0, 0, 0, 0.3);
	}

	.description-text:nth-child(even) {
		transform: translateY(2rem);
	}

	@keyframes blur-fade {
		0% {
			opacity: 0;
			filter: blur(10px);
		}

		25% {
			opacity: 1;
			filter: blur(0);
		}

		75% {
			opacity: 1;
			filter: blur(0);
		}

		100% {
			opacity: 0;
			filter: blur(10px);
		}
	}
</style>
