<!-- 事業内容 -->
<script>
	import company from '$lib/assets/data/company.json';
</script>

<main>
	<div class="summary-container">
		<h1 class="summary-name">事業内容</h1>
		<p class="summary">{company.summary}</p>
	</div>

	{#each company.businesses as business}
		<div class="business-container">
			<h2 class="business-name">{business.name}</h2>
			<span class="separator"></span>
			<p class="business-description">{business.description}</p>
		</div>
	{/each}
</main>

<style>
	main {
		max-width: 15cm;
		margin: auto;
	}

	.summary-container {
		margin-bottom: 3rem;
	}

	.summary-name {
		text-align: center;
		margin-bottom: 1.5rem;
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
</style>
