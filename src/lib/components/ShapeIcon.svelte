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
		heart: 'M12 21s-7.5-4.7-10-9.2C.4 8.9 1.8 5.5 5 5.1c2-.25 3.6 1 3.9 1.9C9.4 6.1 11 4.85 13 5.1c3.2.4 4.6 3.8 3 6.7C19.5 16.3 12 21 12 21z',
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
