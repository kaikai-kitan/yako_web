<!-- 夜行人図鑑のセル -->
<script>
	import { base } from '$app/paths';
	let { directoryItem } = $props();
</script>

<div class="directory-cell-container">
	<div class="directory-image-container">
		{#if directoryItem.image !== ''}
			<img class="directory-image" src={base + directoryItem.image} alt={directoryItem.name} />
		{:else}
			<div class="no-image">NO IMAGE</div>
		{/if}
	</div>
	<div class="directory-information">
		<div>
			<span class="information-key">名前</span>
			<span class="information-value">{directoryItem.name}</span>
		</div>
		{#if directoryItem.age}
			<div>
				<span class="information-key">年齢</span>
				<span class="information-value">{directoryItem.age}</span>
			</div>
		{/if}
		{#if directoryItem.status}
			<div>
				<span class="information-key">社会的階級</span>
				<span class="information-value">{directoryItem.status}</span>
			</div>
		{/if}
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
		min-height: 160px;
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
		width: 160px;
		flex-shrink: 0;
		aspect-ratio: 1;
	}

	.directory-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.no-image {
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		background-color: rgb(238, 217, 192);
		font-size: 0.75rem;
		color: #9e9289;
	}

	.directory-information {
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1;
		min-width: 0;
	}

	.information-key {
		font-size: 0.72rem;
		color: #9e9289;
		margin-right: 4px;
	}

	.information-value {
		font-size: 0.95rem;
		color: #26201a;
	}

	.information-message {
		font-style: italic;
		padding: 8px 0 0;
		line-height: 1.6;
	}

	@media (max-width: 400px) {
		.directory-image-container { width: 120px; }
		.directory-information { padding: 12px; }
	}

	.separator {
		display: block;
		background-color: #d56d04;
		width: 60px;
		height: 1px;
		margin: 8px 0;
	}
</style>
