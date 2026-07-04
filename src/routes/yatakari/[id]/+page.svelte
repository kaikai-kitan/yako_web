<svelte:head>
	<title>屋台詳細 | 微小夜行電灯</title>
</svelte:head>

<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';
	import StallReviews from '$lib/components/StallReviews.svelte';

	const stallId = $derived($page.params.id);

	let stall = $state(null);
	let operator = $state(null);
	let isLoading = $state(true);
	let notFound = $state(false);

	onMount(async () => {
		const { data: stallData, error } = await supabase
			.from('stall_specs')
			.select('*')
			.eq('id', stallId)
			.single();

		if (error || !stallData) {
			notFound = true;
			isLoading = false;
			return;
		}

		stall = stallData;

		const [{ data: opData }, { data: profileData }] = await Promise.all([
			supabase.from('operators').select('business_name, icon_path').eq('user_id', stall.user_id).maybeSingle(),
			supabase.from('user_profiles').select('name, bio').eq('user_id', stall.user_id).maybeSingle()
		]);

		operator = { ...opData, ...profileData };
		isLoading = false;
	});
</script>

<div class="page">
	{#if isLoading}
		<div class="loading-wrap">
			<p class="loading-text">読み込み中…</p>
		</div>
	{:else if notFound}
		<div class="not-found">
			<p>屋台が見つかりませんでした。</p>
			<a href="{base}/map" class="back-link">マップに戻る</a>
		</div>
	{:else if stall}
		<!-- 写真 -->
		{#if stall.photo_path}
			<div class="hero-img-wrap">
				<img src={stall.photo_path} alt={stall.stall_name} class="hero-img" />
			</div>
		{:else}
			<div class="hero-img-wrap no-img">🏮</div>
		{/if}

		<div class="content">
			<a href="{base}/map" class="back-link-top">← マップに戻る</a>

			<h1 class="stall-name">{stall.stall_name}</h1>

			<div class="info-grid">
				<div class="info-item">
					<span class="info-label">レンタル料金</span>
					<span class="info-value">¥{(stall.rental_fee ?? 0).toLocaleString()} / 日</span>
				</div>
				{#if stall.specs}
					<div class="info-item">
						<span class="info-label">スペック</span>
						<span class="info-value">{stall.specs}</span>
					</div>
				{/if}
			</div>

			<!-- オペレーター情報 -->
			{#if operator}
				<div class="operator-row">
					{#if operator.icon_path}
						<img src={operator.icon_path} alt="" class="op-icon" />
					{:else}
						<div class="op-icon placeholder">🏮</div>
					{/if}
					<div class="op-info">
						<span class="op-name">{operator.business_name ?? operator.name ?? '不明'}</span>
						{#if operator.bio}
							<span class="op-bio">{operator.bio}</span>
						{/if}
					</div>
				</div>
			{/if}

			<!-- レビューコンポーネント -->
			<StallReviews {stallId} />
		</div>
	{/if}
</div>

<style>
	.page {
		min-height: 100svh;
		background: var(--surface-sunk);
		font-family: sans-serif;
		padding-bottom: 60px;
	}

	.loading-wrap, .not-found {
		display: flex; flex-direction: column;
		align-items: center; justify-content: center;
		min-height: 40vh; gap: 16px;
		color: var(--ink-3); font-size: 0.9rem;
	}

	.hero-img-wrap {
		width: 100%; aspect-ratio: 4/3; max-height: 360px;
		overflow: hidden; background: var(--surface-sunk);
	}
	.hero-img-wrap.no-img {
		display: flex; align-items: center; justify-content: center;
		font-size: 5rem;
	}
	.hero-img { width: 100%; height: 100%; object-fit: cover; display: block; }

	.content { padding: 16px 20px; max-width: 640px; margin: 0 auto; }

	.back-link-top {
		display: inline-block; font-size: 0.8rem; color: var(--ink-2);
		text-decoration: none; margin-bottom: 14px;
	}
	.back-link-top:hover { color: var(--ink); }
	.back-link { font-size: 0.88rem; color: #5a6e99; text-decoration: none; }

	.stall-name {
		font-size: 1.4rem; font-weight: 800; color: var(--ink);
		margin: 0 0 16px; line-height: 1.3;
	}

	.info-grid {
		display: flex; flex-direction: column; gap: 10px;
		background: white; border-radius: 14px;
		padding: 16px; margin-bottom: 20px;
		border: 1px solid var(--surface-sunk);
	}
	.info-item { display: flex; justify-content: space-between; align-items: baseline; }
	.info-label { font-size: 0.78rem; color: var(--ink-3); font-weight: 600; }
	.info-value { font-size: 0.88rem; color: var(--ink); font-weight: 600; text-align: right; max-width: 60%; }

	.operator-row {
		display: flex; align-items: center; gap: 12px;
		background: white; border-radius: 14px;
		padding: 14px; margin-bottom: 4px;
		border: 1px solid var(--surface-sunk);
	}
	.op-icon {
		width: 44px; height: 44px; border-radius: 50%;
		object-fit: cover; flex-shrink: 0;
	}
	.op-icon.placeholder {
		display: flex; align-items: center; justify-content: center;
		background: var(--surface-sunk); font-size: 1.4rem;
	}
	.op-info { display: flex; flex-direction: column; gap: 2px; }
	.op-name { font-size: 0.9rem; font-weight: 700; color: var(--ink); }
	.op-bio { font-size: 0.78rem; color: var(--ink-2); line-height: 1.5; }
</style>
