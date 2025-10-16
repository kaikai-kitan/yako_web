<!-- 基本レイアウト -->
<script>
	import favicon from '$lib/assets/favicon.png';

	import Header from '$lib/components/Header.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="stylesheet" href="global.css" />

	<title>微小夜行電灯</title>
</svelte:head>

<Header />

{@render children?.()}

<footer>
	<small>&copy;2025 All rights reserved</small>
</footer>

<style>
	footer {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
