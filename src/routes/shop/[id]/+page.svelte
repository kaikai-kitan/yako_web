<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';
	import { cart, cartCount, cartTotal, cartItems } from '$lib/cart.js';

	let product = $state(null);
	let isLoading = $state(true);
	let fetchError = $state('');
	let quantity = $state(1);
	let addedMsg = $state('');
	let isCartOpen = $state(false);
	let isCheckingOut = $state(false);
	let checkoutError = $state('');

	onMount(async () => {
		const id = $page.params.id;
		const { data, error } = await supabase
			.from('shop_products')
			.select('*')
			.eq('id', id)
			.eq('is_active', true)
			.single();

		if (error || !data) {
			fetchError = '商品が見つかりませんでした';
		} else {
			product = data;
		}
		isLoading = false;
	});

	function handleAddToCart() {
		if (!product) return;
		for (let i = 0; i < quantity; i++) {
			cart.add(product);
		}
		addedMsg = 'カートに追加しました！';
		setTimeout(() => (addedMsg = ''), 2500);
	}

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
			photoUrl: c.product.photo_url ?? null
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
			if (!res.ok) throw new Error(await res.text());
			const { url } = await res.json();
			window.location.href = url;
		} catch (e) {
			checkoutError = e.message;
			isCheckingOut = false;
		}
	}
</script>

<svelte:head>
	{#if product}
		<title>{product.name} | オンラインストア | 微小夜行電灯</title>
	{:else}
		<title>商品詳細 | オンラインストア | 微小夜行電灯</title>
	{/if}
</svelte:head>

<div class="detail-page">
	<!-- ヘッダー -->
	<header class="detail-header">
		<a href="{base}/shop" class="back-link">← 一覧に戻る</a>
		<span class="header-title">オンラインストア</span>
		<button class="cart-btn" onclick={() => (isCartOpen = true)} aria-label="カートを開く">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="cart-svg" aria-hidden="true">
				<circle cx="9" cy="21" r="1"/>
				<circle cx="20" cy="21" r="1"/>
				<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
			</svg>
			{#if $cartCount > 0}
				<span class="cart-badge">{$cartCount}</span>
			{/if}
		</button>
	</header>

	<main class="detail-main">
		{#if isLoading}
			<div class="loading">読み込み中…</div>
		{:else if fetchError || !product}
			<div class="error-msg">{fetchError || '商品が見つかりませんでした'}</div>
			<a href="{base}/shop" class="back-text">← ストアに戻る</a>
		{:else}
			<div class="detail-layout">
				<!-- 商品画像 -->
				<div class="image-col">
					{#if product.photo_url}
						<img src={product.photo_url} alt={product.name} class="product-photo" />
					{:else}
						<div class="product-photo no-img">🛍</div>
					{/if}
				</div>

				<!-- 商品情報 -->
				<div class="info-col">
					<p class="brand">微小夜行電灯</p>
					<h1 class="product-name">{product.name}</h1>
					<p class="product-price">¥{product.price.toLocaleString()}<span class="tax-note">（税込）</span></p>

					{#if product.description}
						<p class="product-desc">{product.description}</p>
					{/if}

					<div class="divider"></div>

					{#if product.stock === 0}
						<div class="sold-out-badge">現在売り切れです</div>
					{:else}
						<!-- 数量選択 -->
						<div class="qty-section">
							<span class="qty-label">数量</span>
							<div class="qty-control">
								<button
									class="qty-btn"
									onclick={() => quantity = Math.max(1, quantity - 1)}
									disabled={quantity <= 1}
								>−</button>
								<span class="qty-value">{quantity}</span>
								<button
									class="qty-btn"
									onclick={() => quantity = quantity + 1}
								>＋</button>
							</div>
						</div>

						<!-- カートに追加 -->
						<button class="add-to-cart-btn" onclick={handleAddToCart}>
							カートに追加する
						</button>

						{#if addedMsg}
							<p class="added-msg">{addedMsg}</p>
						{/if}
					{/if}
				</div>
			</div>
		{/if}
	</main>

	<!-- カート浮きボタン -->
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
			<div class="cart-header-row">
				<h2>カート</h2>
				<button class="close-btn" onclick={() => (isCartOpen = false)}>×</button>
			</div>

			{#if $cartItems.length === 0}
				<p class="cart-empty">カートに商品がありません</p>
			{:else}
				<div class="cart-list">
					{#each $cartItems as { product: p, quantity: q }}
						<div class="cart-item">
							{#if p.photo_url}
								<img src={p.photo_url} alt={p.name} class="cart-thumb" />
							{:else}
								<div class="cart-thumb no-img-sm">🛍</div>
							{/if}
							<div class="cart-item-info">
								<span class="cart-item-name">{p.name}</span>
								<span class="cart-item-price">¥{p.price.toLocaleString()}</span>
							</div>
							<div class="qty-control-sm">
								<button onclick={() => cart.updateQty(p.id, -1)}>−</button>
								<span>{q}</span>
								<button onclick={() => cart.updateQty(p.id, 1)}>＋</button>
							</div>
						</div>
					{/each}
				</div>

				<div class="cart-total-row">
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
	.detail-page {
		min-height: 100svh;
		background: #faf8f5;
		font-family: sans-serif;
	}

	/* ヘッダー */
	.detail-header {
		position: sticky; top: 60px; z-index: 100;
		background: rgba(250,248,245,0.97);
		backdrop-filter: blur(8px);
		border-bottom: 1px solid #e8e0d8;
		display: flex; align-items: center; justify-content: space-between;
		padding: 14px 16px;
	}
	.back-link { font-size: 0.85rem; color: #7a6f67; text-decoration: none; white-space: nowrap; }
	.header-title { font-size: 1rem; font-weight: 700; color: #26201a; }
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

	/* メインレイアウト */
	.detail-main {
		max-width: 900px;
		margin: 0 auto;
		padding: 24px 16px 80px;
	}

	.loading, .error-msg {
		text-align: center; padding: 60px 20px; color: #9e9289; font-size: 0.9rem;
	}
	.error-msg { color: #c62828; }
	.back-text { display: block; text-align: center; margin-top: 16px; color: #26201a; font-size: 0.9rem; }

	/* デスクトップ: 左右2カラム、モバイル: 縦積み */
	.detail-layout {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	@media (min-width: 640px) {
		.detail-layout {
			flex-direction: row;
			align-items: flex-start;
			gap: 40px;
		}
		.image-col { flex: 1; position: sticky; top: 120px; }
		.info-col { flex: 1; }
	}

	/* 画像 */
	.product-photo {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: 16px;
		display: block;
	}
	.no-img {
		width: 100%; aspect-ratio: 1;
		background: #f0ebe3;
		border-radius: 16px;
		display: flex; align-items: center; justify-content: center;
		font-size: 4rem;
	}

	/* 商品情報 */
	.brand {
		font-size: 0.75rem;
		color: #9e9289;
		letter-spacing: 0.08em;
		margin: 0 0 6px;
		text-transform: uppercase;
	}
	.product-name {
		font-size: 1.4rem;
		font-weight: 700;
		color: #26201a;
		margin: 0 0 12px;
		line-height: 1.3;
	}
	.product-price {
		font-size: 1.5rem;
		font-weight: 700;
		color: #26201a;
		margin: 0 0 16px;
	}
	.tax-note {
		font-size: 0.8rem;
		font-weight: 400;
		color: #9e9289;
		margin-left: 4px;
	}
	.product-desc {
		font-size: 0.9rem;
		color: #5a504a;
		line-height: 1.7;
		margin: 0 0 16px;
		white-space: pre-wrap;
	}
	.divider {
		height: 1px;
		background: #e8e0d8;
		margin: 20px 0;
	}

	/* 数量 */
	.qty-section {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-bottom: 16px;
	}
	.qty-label { font-size: 0.88rem; color: #26201a; font-weight: 600; }
	.qty-control {
		display: flex; align-items: center; gap: 12px;
		border: 1.5px solid #e2ddd8; border-radius: 8px;
		padding: 4px 8px;
	}
	.qty-btn {
		width: 28px; height: 28px; border: none; background: none;
		font-size: 1.2rem; cursor: pointer; color: #26201a;
		display: flex; align-items: center; justify-content: center;
		border-radius: 4px;
	}
	.qty-btn:disabled { color: #ccc; cursor: not-allowed; }
	.qty-value { font-size: 1rem; font-weight: 600; min-width: 24px; text-align: center; }

	/* カートに追加ボタン */
	.add-to-cart-btn {
		width: 100%;
		padding: 16px;
		background: #26201a;
		color: white;
		border: none;
		border-radius: 12px;
		font-size: 1rem;
		font-weight: 700;
		font-family: inherit;
		cursor: pointer;
		transition: background 0.15s;
	}
	.add-to-cart-btn:hover { background: #3d3029; }

	.added-msg {
		text-align: center;
		color: #2e7d32;
		font-size: 0.88rem;
		margin-top: 10px;
		font-weight: 600;
	}

	.sold-out-badge {
		padding: 14px;
		background: #f5f0ea;
		border-radius: 12px;
		text-align: center;
		color: #9e9289;
		font-size: 0.9rem;
		font-weight: 600;
	}

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
	.cart-header-row {
		display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;
	}
	.cart-header-row h2 { margin: 0; font-size: 1.1rem; color: #26201a; }
	.close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #7a6f67; }
	.cart-empty { text-align: center; color: #9e9289; padding: 24px 0; }

	.cart-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
	.cart-item { display: flex; align-items: center; gap: 10px; }
	.cart-thumb { width: 52px; height: 52px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
	.no-img-sm {
		width: 52px; height: 52px; border-radius: 8px;
		background: #f5f0ea; display: flex; align-items: center;
		justify-content: center; font-size: 1.4rem; flex-shrink: 0;
	}
	.cart-item-info { flex: 1; min-width: 0; }
	.cart-item-name { display: block; font-size: 0.88rem; font-weight: 600; color: #26201a; }
	.cart-item-price { font-size: 0.8rem; color: #7a6f67; }
	.qty-control-sm { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
	.qty-control-sm button {
		width: 28px; height: 28px; border-radius: 50%;
		border: 1.5px solid #e2ddd8; background: white;
		font-size: 1rem; cursor: pointer;
		display: flex; align-items: center; justify-content: center;
	}
	.qty-control-sm span { font-size: 0.9rem; font-weight: 600; min-width: 16px; text-align: center; }

	.cart-total-row {
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
