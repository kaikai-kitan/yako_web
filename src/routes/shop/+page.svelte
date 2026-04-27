<script>
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';
	import { cart, cartItems, cartCount, cartTotal } from '$lib/cart.js';

	let products = $state([]);
	let isLoading = $state(true);
	let fetchError = $state('');
	let isCheckingOut = $state(false);
	let checkoutError = $state('');
	let isCartOpen = $state(false);

	let searchQuery = $state('');
	let selectedCategory = $state('すべて');
	let sortMode = $state('おすすめ順');

	const SORT_OPTIONS = ['おすすめ順', '価格が安い順', '価格が高い順'];

	onMount(async () => {
		const { data, error } = await supabase
			.from('shop_products')
			.select('*')
			.eq('is_active', true)
			.order('display_order', { ascending: true })
			.order('created_at', { ascending: true });

		if (error) {
			fetchError = '商品の取得に失敗しました';
		} else {
			products = data ?? [];
		}
		isLoading = false;
	});

	// カテゴリ一覧（商品のcategoryフィールドから動的生成 or フォールバック）
	let categories = $derived(() => {
		const cats = new Set(products.map(p => p.category).filter(Boolean));
		return ['すべて', ...cats];
	});

	let filteredProducts = $derived(() => {
		let result = [...products];
		if (selectedCategory !== 'すべて') {
			result = result.filter(p => p.category === selectedCategory);
		}
		if (searchQuery.trim()) {
			const q = searchQuery.trim().toLowerCase();
			result = result.filter(p =>
				p.name.toLowerCase().includes(q) ||
				(p.description ?? '').toLowerCase().includes(q)
			);
		}
		if (sortMode === '価格が安い順') result.sort((a, b) => a.price - b.price);
		else if (sortMode === '価格が高い順') result.sort((a, b) => b.price - a.price);
		return result;
	});

	let recommendedProducts = $derived(products.slice(0, 4));
	let rankingProducts = $derived(products.slice(0, 5));

	let isSearching = $derived(searchQuery.trim().length > 0 || selectedCategory !== 'すべて');

	async function checkout() {
		if ($cartItems.length === 0) return;
		isCheckingOut = true;
		checkoutError = '';

		const { data: { session } } = await supabase.auth.getSession();
		const origin = window.location.origin;

		const items = $cartItems.map((c) => ({
			name: c.product.name,
			price: c.product.price,
			quantity: c.quantity,
			photoUrl: c.product.photo_url ?? null,
			productId: c.product.id ?? null
		}));

		try {
			const res = await fetch('/api/create-checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					items,
					userId: session?.user?.id ?? null,
					successUrl: `${origin}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
					cancelUrl: `${origin}/shop/cancel`
				})
			});

			if (!res.ok) {
				const errBody = await res.text();
				throw new Error(`決済エラー(${res.status}): ${errBody}`);
			}
			const { url } = await res.json();
			window.location.href = url;
		} catch (e) {
			checkoutError = e.message;
			isCheckingOut = false;
		}
	}
</script>

<svelte:head>
	<title>オンラインストア | 微小夜行電灯</title>
</svelte:head>

<div class="shop-page">
	<!-- ヘッダー -->
	<header class="shop-header">
		<a href="{base}/" class="back-link" aria-label="トップへ戻る">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
				stroke-linecap="round" stroke-linejoin="round" class="back-icon">
				<polyline points="15 18 9 12 15 6"/>
			</svg>
		</a>
		<h1 class="shop-title">オンラインストア「電灯」</h1>
		<button class="cart-btn" onclick={() => (isCartOpen = true)} aria-label="カートを開く">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
				stroke-linecap="round" stroke-linejoin="round" class="cart-svg" aria-hidden="true">
				<circle cx="9" cy="21" r="1"/>
				<circle cx="20" cy="21" r="1"/>
				<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
			</svg>
			{#if $cartCount > 0}
				<span class="cart-badge">{$cartCount}</span>
			{/if}
		</button>
	</header>

	<!-- パンくずナビゲーション -->
	<nav class="breadcrumb" aria-label="パンくず">
		<a href="{base}/" class="breadcrumb-link">トップ</a>
		<span class="breadcrumb-sep">/</span>
		<span class="breadcrumb-current">オンラインストア</span>
	</nav>

	<!-- 検索バー -->
	<div class="search-bar-wrap">
		<div class="search-bar">
			<svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
				stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
			</svg>
			<input
				type="search"
				class="search-input"
				placeholder="キーワードを入力"
				bind:value={searchQuery}
			/>
			{#if searchQuery}
				<button class="search-clear" onclick={() => (searchQuery = '')} aria-label="クリア">×</button>
			{/if}
		</div>
	</div>

	<main class="shop-main">
		{#if isLoading}
			<div class="loading">読み込み中…</div>
		{:else if fetchError}
			<div class="error-msg">{fetchError}</div>
		{:else if products.length === 0}
			<div class="empty">現在販売中の商品はありません</div>
		{:else if isSearching}
			<!-- 検索・カテゴリ絞り込み結果 -->
			<div class="result-header">
				<span class="result-count">検索結果 {filteredProducts.length}件</span>
				<select class="sort-select" bind:value={sortMode}>
					{#each SORT_OPTIONS as opt}
						<option>{opt}</option>
					{/each}
				</select>
			</div>
			{#if filteredProducts.length === 0}
				<div class="empty">該当する商品が見つかりませんでした</div>
			{:else}
				<div class="product-grid">
					{#each filteredProducts as product}
						<a href="{base}/shop/{product.id}" class="product-card">
							{#if product.photo_url}
								<img src={product.photo_url} alt={product.name} class="product-img" />
							{:else}
								<div class="product-img no-img">🛍</div>
							{/if}
							<div class="product-body">
								<h2 class="product-name">{product.name}</h2>
								<span class="product-price">¥{product.price.toLocaleString()}</span>
								{#if product.stock === 0}
									<span class="sold-out">売り切れ</span>
								{/if}
							</div>
						</a>
					{/each}
				</div>
			{/if}
		{:else}
			<!-- カテゴリチップ -->
			{#if categories.length > 1}
				<div class="category-scroll">
					{#each categories as cat}
						<button
							class="category-chip"
							class:active={selectedCategory === cat}
							onclick={() => (selectedCategory = cat)}
						>{cat}</button>
					{/each}
				</div>
			{/if}

			<!-- おすすめセクション -->
			{#if recommendedProducts.length > 0}
				<section class="section">
					<div class="section-header">
						<h2 class="section-title">⭐ おすすめ</h2>
					</div>
					<div class="horizontal-scroll">
						{#each recommendedProducts as product}
							<a href="{base}/shop/{product.id}" class="h-card">
								{#if product.photo_url}
									<img src={product.photo_url} alt={product.name} class="h-card-img" />
								{:else}
									<div class="h-card-img no-img">🛍</div>
								{/if}
								<div class="h-card-body">
									<p class="h-card-name">{product.name}</p>
									<p class="h-card-price">¥{product.price.toLocaleString()}</p>
								</div>
							</a>
						{/each}
					</div>
				</section>
			{/if}

			<!-- 売れ筋ランキングセクション -->
			{#if rankingProducts.length > 0}
				<section class="section">
					<div class="section-header">
						<h2 class="section-title">🏆 売れ筋ランキング</h2>
					</div>
					<div class="ranking-list">
						{#each rankingProducts as product, i}
							<a href="{base}/shop/{product.id}" class="ranking-item">
								<span class="rank-num" class:rank-top={i < 3}>{i + 1}</span>
								{#if product.photo_url}
									<img src={product.photo_url} alt={product.name} class="rank-img" />
								{:else}
									<div class="rank-img no-img-sm">🛍</div>
								{/if}
								<div class="rank-info">
									<p class="rank-name">{product.name}</p>
									<p class="rank-price">¥{product.price.toLocaleString()}</p>
								</div>
								{#if product.stock === 0}
									<span class="sold-out-sm">売り切れ</span>
								{/if}
							</a>
						{/each}
					</div>
				</section>
			{/if}

			<!-- 全商品 -->
			<section class="section">
				<div class="section-header">
					<h2 class="section-title">すべての商品</h2>
					<select class="sort-select" bind:value={sortMode}>
						{#each SORT_OPTIONS as opt}
							<option>{opt}</option>
						{/each}
					</select>
				</div>
				<div class="product-grid">
					{#each filteredProducts as product}
						<a href="{base}/shop/{product.id}" class="product-card">
							{#if product.photo_url}
								<img src={product.photo_url} alt={product.name} class="product-img" />
							{:else}
								<div class="product-img no-img">🛍</div>
							{/if}
							<div class="product-body">
								<h2 class="product-name">{product.name}</h2>
								{#if product.description}
									<p class="product-desc">{product.description}</p>
								{/if}
								<div class="product-footer">
									<span class="product-price">¥{product.price.toLocaleString()}</span>
									{#if product.stock === 0}
										<span class="sold-out">売り切れ</span>
									{:else}
										<span class="detail-link">詳細を見る →</span>
									{/if}
								</div>
							</div>
						</a>
					{/each}
				</div>
			</section>
		{/if}
	</main>

	{#if $cartCount > 0 && !isCartOpen}
		<button class="cart-float" onclick={() => (isCartOpen = true)}>
			🛒 {$cartCount}点 ¥{$cartTotal.toLocaleString()}
		</button>
	{/if}
</div>

<!-- カートドロワー -->
{#if isCartOpen}
	<div
		class="cart-overlay"
		onclick={(e) => e.target === e.currentTarget && (isCartOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (isCartOpen = false)}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div class="cart-drawer">
			<div class="cart-header">
				<h2>カート</h2>
				<button class="close-btn" onclick={() => (isCartOpen = false)}>×</button>
			</div>

			{#if $cartItems.length === 0}
				<p class="cart-empty">カートに商品がありません</p>
			{:else}
				<div class="cart-list">
					{#each $cartItems as { product, quantity }}
						<div class="cart-item">
							{#if product.photo_url}
								<img src={product.photo_url} alt={product.name} class="cart-thumb" />
							{:else}
								<div class="cart-thumb no-img-sm">🛍</div>
							{/if}
							<div class="cart-item-info">
								<span class="cart-item-name">{product.name}</span>
								<span class="cart-item-price">¥{product.price.toLocaleString()}</span>
							</div>
							<div class="qty-control">
								<button onclick={() => cart.updateQty(product.id, -1)}>−</button>
								<span>{quantity}</span>
								<button onclick={() => cart.updateQty(product.id, 1)}>＋</button>
							</div>
						</div>
					{/each}
				</div>

				<div class="cart-total">
					<span>合計</span>
					<span class="total-price">¥{$cartTotal.toLocaleString()}</span>
				</div>

				{#if checkoutError}
					<p class="checkout-error">{checkoutError}</p>
				{/if}

				<button class="checkout-btn" onclick={checkout} disabled={isCheckingOut}>
					{isCheckingOut ? '処理中…' : '購入手続きへ'}
				</button>
			{/if}
		</div>
	</div>
{/if}

<style>
	.shop-page {
		min-height: 100svh;
		background: #faf8f5;
		font-family: sans-serif;
	}

	/* ヘッダー */
	.shop-header {
		position: sticky; top: 60px; z-index: 100;
		background: rgba(250,248,245,0.97);
		backdrop-filter: blur(8px);
		border-bottom: 1px solid #e8e0d8;
		display: flex; align-items: center; justify-content: space-between;
		padding: 12px 16px; gap: 8px;
	}
	.back-icon { width: 22px; height: 22px; stroke: #26201a; display: block; }
	.back-link { flex-shrink: 0; display: flex; align-items: center; }
	.shop-title { font-size: 0.95rem; font-weight: 700; color: #26201a; margin: 0; flex: 1; text-align: center; }
	.cart-btn {
		position: relative; background: none; border: none;
		cursor: pointer; padding: 4px; flex-shrink: 0;
		display: flex; align-items: center;
	}
	.cart-svg { width: 24px; height: 24px; stroke: #26201a; }
	.cart-badge {
		position: absolute; top: -4px; right: -6px;
		background: #e53e3e; color: white; font-size: 0.65rem;
		font-weight: 700; border-radius: 50%;
		min-width: 18px; height: 18px;
		display: flex; align-items: center; justify-content: center;
	}

	/* パンくず */
	.breadcrumb {
		display: flex; align-items: center; gap: 6px;
		padding: 8px 16px; font-size: 0.78rem; color: #9e9289;
		background: #f5f0ea; border-bottom: 1px solid #ede8e0;
	}
	.breadcrumb-link { color: #7a6f67; text-decoration: none; }
	.breadcrumb-link:hover { text-decoration: underline; }
	.breadcrumb-sep { color: #c8bfb5; }
	.breadcrumb-current { color: #26201a; font-weight: 600; }

	/* 検索バー */
	.search-bar-wrap { padding: 12px 16px; background: #faf8f5; }
	.search-bar {
		display: flex; align-items: center; gap: 8px;
		background: white; border: 1.5px solid #e8e0d8;
		border-radius: 10px; padding: 8px 12px;
	}
	.search-icon { width: 18px; height: 18px; stroke: #9e9289; flex-shrink: 0; }
	.search-input {
		flex: 1; border: none; outline: none; background: transparent;
		font-size: 0.95rem; color: #26201a; font-family: inherit;
	}
	.search-input::placeholder { color: #c8bfb5; }
	.search-clear {
		background: none; border: none; font-size: 1rem; color: #9e9289;
		cursor: pointer; padding: 0 2px; line-height: 1;
	}

	.shop-main { padding: 0 0 80px; max-width: 800px; margin: 0 auto; }

	.loading, .empty, .error-msg {
		text-align: center; padding: 60px 20px; color: #9e9289; font-size: 0.9rem;
	}
	.error-msg { color: #c62828; }

	/* カテゴリチップ */
	.category-scroll {
		display: flex; gap: 8px; overflow-x: auto;
		padding: 12px 16px; scrollbar-width: none;
	}
	.category-scroll::-webkit-scrollbar { display: none; }
	.category-chip {
		flex-shrink: 0; padding: 6px 16px;
		border: 1.5px solid #e8e0d8; border-radius: 100px;
		background: white; color: #26201a; font-size: 0.82rem;
		font-family: inherit; cursor: pointer; transition: all 0.15s;
		white-space: nowrap;
	}
	.category-chip.active {
		background: #26201a; color: white; border-color: #26201a;
	}

	/* セクション */
	.section { padding: 16px 0 8px; }
	.section-header {
		display: flex; align-items: center; justify-content: space-between;
		padding: 0 16px 10px;
	}
	.section-title { font-size: 0.95rem; font-weight: 700; color: #26201a; margin: 0; }

	/* ソート */
	.sort-select {
		font-size: 0.78rem; color: #26201a; border: 1px solid #e8e0d8;
		border-radius: 6px; padding: 4px 8px; background: white;
		font-family: inherit; cursor: pointer; outline: none;
	}

	/* 検索結果ヘッダー */
	.result-header {
		display: flex; align-items: center; justify-content: space-between;
		padding: 12px 16px;
	}
	.result-count { font-size: 0.85rem; color: #7a6f67; }

	/* 横スクロールカード（おすすめ） */
	.horizontal-scroll {
		display: flex; gap: 10px; overflow-x: auto;
		padding: 0 16px 4px; scrollbar-width: none;
	}
	.horizontal-scroll::-webkit-scrollbar { display: none; }
	.h-card {
		flex-shrink: 0; width: 130px;
		background: white; border-radius: 12px;
		overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);
		text-decoration: none; color: inherit;
		transition: box-shadow 0.15s;
	}
	.h-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
	.h-card-img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; }
	.h-card-body { padding: 8px 10px 10px; }
	.h-card-name { font-size: 0.78rem; font-weight: 600; color: #26201a; margin: 0 0 3px; line-height: 1.3;
		display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
	.h-card-price { font-size: 0.8rem; font-weight: 700; color: #26201a; margin: 0; }

	/* ランキングリスト */
	.ranking-list { display: flex; flex-direction: column; }
	.ranking-item {
		display: flex; align-items: center; gap: 12px;
		padding: 10px 16px; background: white; border-bottom: 1px solid #f5f0ea;
		text-decoration: none; color: inherit; transition: background 0.15s;
	}
	.ranking-item:hover { background: #faf8f5; }
	.rank-num {
		font-size: 1rem; font-weight: 800; color: #c8bfb5;
		min-width: 20px; text-align: center; flex-shrink: 0;
	}
	.rank-num.rank-top { color: #d56d04; }
	.rank-img { width: 52px; height: 52px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
	.rank-info { flex: 1; min-width: 0; }
	.rank-name { font-size: 0.88rem; font-weight: 600; color: #26201a; margin: 0 0 2px; }
	.rank-price { font-size: 0.8rem; color: #7a6f67; margin: 0; }
	.sold-out-sm { font-size: 0.72rem; color: #9e9289; font-weight: 600; flex-shrink: 0; }

	/* 商品グリッド */
	.product-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 12px; padding: 0 16px;
	}
	@media (min-width: 480px) {
		.product-grid { grid-template-columns: repeat(3, 1fr); }
	}

	.product-card {
		background: white; border-radius: 12px;
		overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);
		text-decoration: none; color: inherit; display: block;
		transition: box-shadow 0.15s, transform 0.15s;
	}
	.product-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.12); transform: translateY(-2px); }
	.product-img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; }
	.no-img, .no-img-sm {
		background: #f5f0ea; display: flex; align-items: center;
		justify-content: center; font-size: 2rem;
	}
	.no-img { width: 100%; aspect-ratio: 1; }
	.no-img-sm { width: 52px; height: 52px; border-radius: 8px; font-size: 1.4rem; flex-shrink: 0; }
	.product-body { padding: 10px 12px 12px; }
	.product-name { font-size: 0.85rem; font-weight: 700; color: #26201a; margin: 0 0 4px; }
	.product-desc {
		font-size: 0.72rem; color: #7a6f67; margin: 0 0 6px;
		line-height: 1.4; display: -webkit-box;
		-webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
	}
	.product-footer { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
	.product-price { font-size: 0.92rem; font-weight: 700; color: #26201a; }
	.detail-link { font-size: 0.7rem; color: #9e9289; }
	.sold-out { font-size: 0.72rem; color: #9e9289; font-weight: 600; }

	/* カート浮きボタン */
	.cart-float {
		position: fixed; bottom: 24px; left: 50%;
		transform: translateX(-50%);
		background: #26201a; color: white;
		border: none; border-radius: 100px;
		padding: 14px 28px; font-size: 0.95rem; font-weight: 700;
		font-family: inherit; cursor: pointer;
		box-shadow: 0 4px 16px rgba(0,0,0,0.25);
		white-space: nowrap; z-index: 50;
	}

	/* カートドロワー */
	.cart-overlay {
		position: fixed; inset: 0; z-index: 200;
		background: rgba(0,0,0,0.5);
		display: flex; align-items: flex-end;
	}
	.cart-drawer {
		width: 100%; max-height: 80svh;
		background: white; border-radius: 20px 20px 0 0;
		padding: 20px 20px 32px; overflow-y: auto;
	}
	.cart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
	.cart-header h2 { margin: 0; font-size: 1.1rem; color: #26201a; }
	.close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #7a6f67; }
	.cart-empty { text-align: center; color: #9e9289; padding: 24px 0; }
	.cart-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
	.cart-item { display: flex; align-items: center; gap: 10px; }
	.cart-thumb { width: 52px; height: 52px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
	.cart-item-info { flex: 1; min-width: 0; }
	.cart-item-name { display: block; font-size: 0.88rem; font-weight: 600; color: #26201a; }
	.cart-item-price { font-size: 0.8rem; color: #7a6f67; }
	.qty-control { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
	.qty-control button {
		width: 28px; height: 28px; border-radius: 50%;
		border: 1.5px solid #e2ddd8; background: white;
		font-size: 1rem; cursor: pointer; display: flex;
		align-items: center; justify-content: center;
	}
	.qty-control span { font-size: 0.9rem; font-weight: 600; min-width: 16px; text-align: center; }
	.cart-total {
		display: flex; justify-content: space-between; align-items: center;
		padding: 12px 0; border-top: 1px solid #e8e0d8; margin-bottom: 12px;
	}
	.total-price { font-size: 1.2rem; font-weight: 700; color: #26201a; }
	.checkout-error { color: #c62828; font-size: 0.85rem; text-align: center; margin: 8px 0; }
	.checkout-btn {
		width: 100%; padding: 14px;
		background: #26201a; color: white;
		border: none; border-radius: 12px;
		font-size: 1rem; font-weight: 700; font-family: inherit; cursor: pointer;
	}
	.checkout-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
