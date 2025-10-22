<!-- 夜行人図鑑のセル -->
<script>
	let { directoryItem } = $props();
</script>

<div class="directory-cell-container">
	<div class="directory-image-container">
		{#if directoryItem.image !== ''}
			<img class="directory-image" src={directoryItem.image} alt={directoryItem.name} />
		{:else}
			<div class="no-image">NO IMAGE</div>
		{/if}
	</div>
	<div class="directory-information">
		<div>
			<span class="information-key">名前</span>
			<span class="information-value">{directoryItem.name}</span>
		</div>
		<div>
			<span class="information-key">年齢</span>
			<span class="information-value">{directoryItem.age}</span>
		</div>
		<div>
			<span class="information-key">社会的階級</span>
			<span class="information-value">{directoryItem.status}</span>
		</div>
		<span class="separator"></span>
		<div class="information-message">
			<span class="information-key">一言</span>
			<span class="information-value">{directoryItem.message}</span>
		</div>
	</div>
</div>

<style>
	.directory-cell-container {
		width: 100%;
		height: 200px;
		clip-path: polygon(
			0% 20px,
			20px 0%,
			100% 0px,
			100% calc(100% - 20px),
			calc(100% - 20px) 100%,
			0px 100%
		);
		overflow: hidden;
		display: flex;
		flex-direction: row;
		background: hsl(40, 50%, 90%);
	}

	.directory-image-container {
		width: 200px;
		aspect-ratio: 1; /* 画像のアスペクト比を4:3に */
	}

	.directory-image {
		width: 200px;
		height: 100%;
		object-fit: cover; /* 画像がコンテナにフィットするように */
	}

	.no-image {
		width: 200px;
		height: 200px;
		display: flex;
		justify-content: center;
		align-items: center;
    background-color: rgb(238, 217, 192);
	}

	.directory-information {
		padding: 20px;
	}

	.information-key {
		font-size: 0.8rem;
	}

	.information-value {
		font-size: 1rem;
	}

	.information-message {
		font-style: italic;
		padding: 10px;
	}

	.separator {
		display: block;
		background-color: #d56d04;
		width: 60px;
		height: 1px;
		margin: 8px 0;
	}
</style>
