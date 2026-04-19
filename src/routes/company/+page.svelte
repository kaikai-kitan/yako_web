<!-- 事業内容 -->
<script>
	import company from '$lib/assets/data/company.json';
	import ImageModalView from '$lib/components/ImageModalView.svelte';
	import ImageView from '$lib/components/ImageView.svelte';

	let imageModalView = $state();
</script>

<div class="company-hero">
	<div class="company-hero-overlay"></div>
	<h1 class="company-hero-title">事業内容</h1>
</div>

<main>
	<div class="summary-container">
		<p class="summary">{company.summary}</p>
	</div>

	{#each company.businesses as business}
		<div class="business-container">
			<h2 class="business-name">{business.name}</h2>
			<span class="separator"></span>
			<p class="business-description">{business.description}</p>
		</div>
	{/each}

	<div class="gallery-container">
		<h1 class="gallery-name">活動実績ギャラリー</h1>
		<div class="gallery-images-container">
			{#each company.gallery as image}
				<ImageView modal={imageModalView} src={image} alt={image} />
			{/each}
		</div>
	</div>

	<ImageModalView bind:this={imageModalView}/>
</main>

<style>
	.company-hero {
		position: relative;
		width: 100%;
		height: 260px;
		background-image: url('/images/shop/yatai.jpg');
		background-size: cover;
		background-position: center;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.company-hero-overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
	}

	.company-hero-title {
		position: relative;
		z-index: 1;
		color: #fff;
		font-size: 2rem;
		letter-spacing: 0.15em;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
		margin: 0;
	}

	main {
		max-width: 15cm;
		margin: auto;
		padding: 0 20px;
	}

	.summary-container {
		margin-top: 2.5rem;
		margin-bottom: 3rem;
	}

	.business-container {
		margin-bottom: 2rem;
	}

	.business-name {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	.separator {
		display: block;
		background-color: #d56d04;
		width: 60px;
		height: 1px;
		margin: 16px 0;
	}

	.gallery-container {
		width: 100%;
	}

	.gallery-name {
    text-align: center;
		margin-bottom: 3rem;
	}

	.gallery-images-container {
		width: 100%;
		display: grid;
    grid-template-columns: repeat(3, calc(33% - 5px));
    grid-auto-rows: auto;
    gap: 10px;
	}
</style>
