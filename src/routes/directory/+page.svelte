<!-- 夜行人図鑑 -->
<script>
	import directoryList from '$lib/assets/data/directory.json';
	import DirectoryListView from '$lib/components/DirectoryListView.svelte';
</script>

<main>
	<h1 class="directory-title">夜行人図鑑</h1>
  <span class="separator"></span>
	<p class="directory-description">
    夜行人図鑑とは屋台に集まったちょっと変わったところのある人が発する迷言や名言を図鑑にして残していくものです。
	</p>
	<DirectoryListView {directoryList} />
  <span class="separator"></span>
</main>

<style>
	main {
		max-width: 15cm;
		margin: auto;
		display: flex;
		flex-direction: column;
		padding: 0 16px;
		box-sizing: border-box;
	}

	.directory-title {
		text-align: center;
		color: #26201a;
		margin-bottom: 1rem;
		margin-top: 2rem;
	}

	.directory-description {
		margin-bottom: 2rem;
		line-height: 1.75;
		color: #4a3f38;
		font-size: 0.95rem;
	}

	.separator {
		display: block;
		background-color: #d56d04;
		width: 60px;
		height: 1px;
		margin: 16px 0;
	}
</style>
