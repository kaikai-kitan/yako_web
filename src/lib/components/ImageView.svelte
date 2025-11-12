<!-- クリックすると拡大表示される画像 -->
<script>
	import { base } from '$app/paths';

	let { modal, src, alt } = $props();

	function onClickImage() {
		modal.showImage(src, alt);
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="image-container" onclick={onClickImage}>
	<image class="image" src={base + src} {alt} />
</div>

<style>
	.image-container {
		width: 100%;
		aspect-ratio: 1 / 1;
	}

	.image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		cursor: pointer;
		transition: all 0.3s ease-out;
	}

	.image:hover {
		transform: translateY(-5px);
		z-index: 1000;
	}
</style>
