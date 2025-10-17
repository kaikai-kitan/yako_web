<!-- メインページ -->
<script>
	import ImageSlideshow from '$lib/components/ImageSlideshow.svelte';
	import SplashView from '$lib/components/SplashView.svelte';
	import { onMount } from 'svelte';

	let splash = $state();
	let images = [
		{
			src: '/images/home_image/active01.jpg',
			alt: 'active 01'
		},
		{
			src: '/images/home_image/active02.jpg',
			alt: 'active 02'
		},
		{
			src: '/images/home_image/active03.jpg',
			alt: 'active 03'
		},
		{
			src: '/images/home_image/active04.jpg',
			alt: 'active 04'
		}
	];

	function showSplashInNecessary() {
		const noSplashExpirationKey = 'no_splash_expiration_key';
		const noSplashExpirationValue = localStorage.getItem(noSplashExpirationKey);

		// localStorage にキーが存在しなかったら
		if (noSplashExpirationValue === null) {
			// localStorage に存在する期限を超過しているな実行
			if (Date.parse(noSplashExpirationValue) < Date.now()) {
				splash.showSplash();
				localStorage.setItem(new Date().toDateString());
			}
		}
	}

	onMount(() => {
		showSplashInNecessary();
		// splash.showSplash();
	});
</script>

<main>
	<SplashView bind:this={splash} />
	<div class="top-garalley-mask">
		<div class="top-garalley">
			<div class="slideshow-container">
				<div class="slideshow">
					<ImageSlideshow {images} />
				</div>
			</div>

			<div class="description">
				<div class="description-text scroll-trigger">
					<p class="highlight">微小夜行電灯</p>
				</div>
				<div class="description-text scroll-trigger">
					<p>
						京都に流れる鴨川の河川敷で<br />
						ゆったりとした時間を過ごせる
					</p>
				</div>
				<div class="description-text scroll-trigger">
					<p>
						<strong>おもろい空間</strong>を作りたいと思い、<br />
						京都府を中心に活動をする夜行人です
					</p>
				</div>
			</div>
		</div>
	</div>

	<!-- <div class="deformed-image-container">
		<img src="../images/yatai_defo.jpg" alt="デフォルメされた屋台イラスト" class="deformed-img" />
	</div> -->

	<article>
		<section></section>
	</article>
</main>

<section class="reservation-section">
	<h2>屋台貸し出しのご予約はこちら</h2>
	<p>以下のカレンダーで空き状況をご確認の上、フォームよりご予約ください。</p>
	<div class="reservation-container">
		<div class="calendar-embed">
			<h3>予約状況カレンダー</h3>
			<iframe
				title="予約状況カレンダー"
				src="https://calendar.google.com/calendar/embed?src=cfed507b8bd3c50b9beb4a6f84023b9b3331c85252e96c95b0d6812102cf80b7%40group.calendar.google.com&ctz=Asia%2FTokyo"
				style="border: 0"
				width="100%"
				height="600"
				frameborder="0"
				scrolling="no"
			></iframe>
		</div>
		<div class="form-embed">
			<h3>予約フォーム</h3>
			<iframe
				title="屋台予約フォーム"
				src="https://docs.google.com/forms/d/e/1FAIpQLSdcQyz_HwlTNo67d72XjLdgDFU4SO1vgGPBdW0A4F2_XaC48A/viewform?embedded=true"
				width="100%"
				height="800"
				frameborder="0"
				marginheight="0"
				marginwidth="0">読み込んでいます…</iframe
			>
		</div>
	</div>
</section>

<style>
	.top-garalley-mask {
		width: 800px;
		height: 600px;
		overflow: scroll;
		scrollbar-width: 0;
	}

	.top-garalley-mask::-webkit-scrollbar {
		display: none;
	}

	.top-garalley {
		display: flex;
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

	.description {
		max-width: 500px;
		height: 1600px;
		flex-grow: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
	}

	.description-text {
		height: 600px;
		writing-mode: vertical-lr;
		font-size: 20px;
		text-align: center;
	}	

</style>
