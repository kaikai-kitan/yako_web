<!--
	YATAKARI アプリのボトムナビ（5枠）。
	左から: マップ / ネットワーク / オンラインストア / マイページ / ・・・（メニュー）
	「・・・」に お問い合わせ と ログイン/ログアウト（セッションで切替）を内包。
-->
<script>
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { session } from '$lib/auth.js';
	import { signOut } from '$lib/db.js';
	import Icon from '$lib/components/Icon.svelte';

	let path = $derived($page.url.pathname);
	let moreOpen = $state(false);


	const tabs = [
		{ label: 'マップ',           icon: 'map',          href: `${base}/map`,              match: (p) => p.startsWith('/map') || p.startsWith('/yatakari') },
		{ label: 'ネットワーク',     icon: 'share',           href: `${base}/network`,          match: (p) => p.startsWith('/directory') || p.startsWith('/network') || p.startsWith('/groups') },
		{ label: 'オンラインストア', icon: 'shopping-bag', href: `${base}/shop`,             match: (p) => p.startsWith('/shop') },
		{ label: 'マイページ',       icon: 'user',         href: `${base}/mypage/dashboard`, match: (p) => p.startsWith('/mypage') }
	];

	async function handleSignOut() {
		moreOpen = false;
		await signOut();
		goto(`${base}/`);
	}
</script>

{#if moreOpen}
	<div class="more-overlay" onclick={() => (moreOpen = false)} role="presentation"></div>
	<div class="more-menu" role="menu">
		<a href="{base}/contact" class="more-item" role="menuitem" onclick={() => (moreOpen = false)}>
			<Icon name="mail" size={17} /> お問い合わせ
		</a>
		{#if $session}
			<button class="more-item" role="menuitem" onclick={handleSignOut}>
				<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
				ログアウト
			</button>
		{:else}
			<a href="{base}/auth" class="more-item" role="menuitem" onclick={() => (moreOpen = false)}>
				<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
				ログイン
			</a>
		{/if}
	</div>
{/if}

<nav class="bottom-nav" aria-label="YATAKARI ナビゲーション">
	{#each tabs as t}
		{@const active = t.match(path)}
		<a href={t.href} class="bn-item" class:active aria-current={active ? 'page' : undefined}>
			<Icon name={t.icon} size={22} />
			<span class="bn-label">{#if t.label === 'オンラインストア'}オンライン<br />ストア{:else}{t.label}{/if}</span>
		</a>
	{/each}
	<button class="bn-item more-btn" class:active={moreOpen} onclick={() => (moreOpen = !moreOpen)} aria-haspopup="menu" aria-expanded={moreOpen}>
		<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
		<span class="bn-label">メニュー</span>
	</button>
</nav>

<style>
	.bottom-nav {
		position: fixed;
		left: 0; right: 0; bottom: 0;
		z-index: 60;
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		height: var(--bottom-nav-height);
		box-sizing: border-box;
		background: #fffdf7;
		border-top: 1px solid var(--line);
		padding: 0 env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
		box-shadow: 0 -2px 16px rgba(60, 45, 25, 0.06);
		/* スクロール（特に下→最上部への戻り）でバーが一瞬ずれる対策:
		   ・JS で位置を書き換えない（visualViewport 追従は描画が1フレーム遅れて揺れの原因になる）
		   ・独立した合成レイヤーにして、ページのスクロール/再描画に引きずられないようにする
		   ・高さは固定値（ラベルの折返しや読み込み中の変化で高さが変わらない） */
		transform: translate3d(0, 0, 0);
		-webkit-backface-visibility: hidden;
		backface-visibility: hidden;
		will-change: transform;
	}

	.bn-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		min-height: 0;
		min-width: 0;
		height: var(--bottom-nav-content-height);
		box-sizing: border-box;
		padding: 6px 2px;
		text-decoration: none;
		color: var(--ink-3);
		font-size: 0.62rem;
		font-weight: 500;
		letter-spacing: 0;
		transition: color 0.15s;
		-webkit-tap-highlight-color: transparent;
	}
	.more-btn { background: none; border: none; cursor: pointer; font-family: var(--font-gothic); }
	.bn-item :global(.icon) { color: currentColor; flex-shrink: 0; }
	.bn-item svg { flex-shrink: 0; }
	.bn-item.active { color: var(--accent); }
	.bn-item:not(.active):hover { color: var(--ink-2); }
	.bn-label { line-height: 1.2; height: 2.4em; display: grid; align-content: center; text-align: center; white-space: nowrap; }

	/* 「・・・」メニュー（マップの各種オーバーレイより前面に） */
	.more-overlay { position: fixed; inset: 0; z-index: 1490; }
	.more-menu {
		position: fixed; z-index: 1500; right: 8px;
		bottom: calc(var(--bottom-nav-height) + 8px);
		background: var(--surface); border: 1px solid var(--line);
		border-radius: 14px; box-shadow: 0 6px 28px rgba(60,45,25,0.18);
		padding: 6px; min-width: 190px; display: flex; flex-direction: column;
	}
	.more-item {
		display: flex; align-items: center; gap: 10px;
		padding: 12px 14px; border-radius: 9px;
		font-size: 0.88rem; font-weight: 500; color: var(--ink);
		text-decoration: none; background: none; border: none; cursor: pointer;
		font-family: var(--font-gothic); text-align: left; width: 100%;
	}
	.more-item:hover { background: var(--surface-sunk); }
	.more-item :global(.icon) { color: var(--ink-2); }
	.more-item svg { color: var(--ink-2); }
</style>
