<!--
	アイコン形状のプレビュー（SVGアウトライン）。
	夜行人図鑑の 3D アイコンで使う形状（circle/star/heart/diamond/hexagon）を
	マイページの選択UIなどで表示するための軽量コンポーネント。
	props: shape, size(px), filled(boolean)
-->
<script>
	let { shape = 'circle', size = 40, filled = false } = $props();

	// 24x24 viewBox 上の各形状パス
	const PATHS = {
		star: 'M12 2.2l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.1l-5.8 3.05 1.1-6.47L2.6 9.05l6.5-.95z',
		heart: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
		diamond: 'M12 2l10 10-10 10L2 12z',
		hexagon: 'M6.5 3h11l5.5 9-5.5 9h-11L1 12z'
	};
	const isCircle = $derived(shape === 'circle' || !PATHS[shape]);
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill={filled ? 'currentColor' : 'none'}
	stroke="currentColor"
	stroke-width={filled ? 0 : 1.7}
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if isCircle}
		<circle cx="12" cy="12" r="9.5" />
	{:else}
		<path d={PATHS[shape]} />
	{/if}
</svg>
