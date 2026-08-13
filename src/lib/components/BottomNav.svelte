<!--
	YATAKARI アプリのボトムナビ（5タブ）。
	右から: マップ / 夜行人図鑑 / オンラインストア / お問い合わせ / マイページ
	→ 左→右の並びは [マイページ, お問い合わせ, ストア, 夜行人図鑑, マップ]
-->
<script>
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import Icon from '$lib/components/Icon.svelte';

	let path = $derived($page.url.pathname);

	const tabs = [
		{ label: 'マイページ',       icon: 'user',         href: `${base}/mypage/dashboard`, match: (p) => p.startsWith('/mypage') },
		{ label: 'お問い合わせ',     icon: 'mail',         href: `${base}/contact`,          match: (p) => p.startsWith('/contact') },
		{ label: 'オンラインストア', icon: 'shopping-bag', href: `${base}/shop`,             match: (p) => p.startsWith('/shop') },
		{ label: '夜行人図鑑',       icon: 'share',        href: `${base}/network`,          match: (p) => p.startsWith('/directory') || p.startsWith('/network') || p.startsWith('/groups') },
		{ label: 'マップ',           icon: 'map',          href: `${base}/map`,              match: (p) => p.startsWith('/map') || p.startsWith('/yatakari') }
	];
</script>

<nav class="bottom-nav" aria-label="YATAKARI ナビゲーション">
	{#each tabs as t}
		{@const active = t.match(path)}
		<a href={t.href} class="bn-item" class:active aria-current={active ? 'page' : undefined}>
			<Icon name={t.icon} size={22} />
			<span class="bn-label">{t.label}</span>
		</a>
	{/each}
</nav>

<style>
	.bottom-nav {
		position: fixed;
		left: 0; right: 0; bottom: 0;
		z-index: 60;
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		background: rgba(255, 253, 247, 0.97);
		backdrop-filter: blur(10px);
		border-top: 1px solid var(--line);
		padding-bottom: env(safe-area-inset-bottom, 0);
		box-shadow: 0 -2px 16px rgba(60, 45, 25, 0.06);
	}
	.bn-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		gap: 4px;
		min-height: 54px;
		padding: 8px 2px;
		text-decoration: none;
		color: var(--ink-3);
		font-size: 0.62rem;
		font-weight: 600;
		letter-spacing: 0;
		transition: color 0.15s;
		-webkit-tap-highlight-color: transparent;
	}
	.bn-item :global(.icon) { color: currentColor; flex-shrink: 0; }
	.bn-item.active { color: var(--accent); }
	.bn-item:not(.active):hover { color: var(--ink-2); }
	.bn-label { line-height: 1.2; text-align: center; word-break: keep-all; }
</style>
