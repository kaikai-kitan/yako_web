<svelte:head><title>法人ダッシュボード | 微小夜行電灯</title></svelte:head>

<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';
	import { getMyProfile, uploadImage } from '$lib/db.js';
	import Icon from '$lib/components/Icon.svelte';

	let userId = $state('');
	let accessToken = $state('');
	let profile = $state(null);
	let isLoading = $state(true);

	// 広告フォーム
	let headline = $state('');
	let storeUrl = $state('');
	let recruitUrl = $state('');
	let adImagePreview = $state('');
	let adImageFile = $state(null);

	let saveMsg = $state('');
	let errMsg = $state('');
	let busy = $state(false);

	onMount(async () => {
		const { data: { session } } = await supabase.auth.getSession();
		if (!session) { goto(`${base}/auth`); return; }
		userId = session.user.id;
		accessToken = session.access_token;

		profile = await getMyProfile(userId);
		if (!profile) { goto(`${base}/mypage`); return; }
		// 法人（承認済み）以外はマイページへ
		if (profile.account_type !== 'corporate' || profile.corp_status !== 'approved') {
			goto(`${base}/mypage`); return;
		}

		headline = profile.ad_headline ?? '';
		storeUrl = profile.ad_store_url ?? '';
		recruitUrl = profile.ad_recruit_url ?? '';
		adImagePreview = profile.ad_image_path ?? '';

		isLoading = false;
	});

	function onImagePick(e) {
		const file = e.target.files?.[0];
		if (!file) return;
		adImageFile = file;
		adImagePreview = URL.createObjectURL(file);
	}

	async function saveAd() {
		errMsg = ''; saveMsg = '';
		busy = true;
		try {
			let imagePath = profile.ad_image_path ?? '';
			if (adImageFile) {
				imagePath = await uploadImage(userId, adImageFile, 'profile-images');
			}
			const res = await fetch('/api/corporate/ad', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
				body: JSON.stringify({ headline, storeUrl, recruitUrl, imagePath })
			});
			if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message ?? '保存に失敗しました'); }
			profile = { ...profile, ad_headline: headline, ad_store_url: storeUrl, ad_recruit_url: recruitUrl, ad_image_path: imagePath };
			adImageFile = null;
			saveMsg = '広告を保存しました。夜行人図鑑に反映されます。';
			setTimeout(() => (saveMsg = ''), 4000);
		} catch (e) { errMsg = e.message; } finally { busy = false; }
	}

	async function subscribe() {
		errMsg = ''; busy = true;
		try {
			const res = await fetch('/api/subscription/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
				body: JSON.stringify({})
			});
			const d = await res.json().catch(() => ({}));
			if (!res.ok || !d.url) throw new Error(d.message ?? '決済ページの作成に失敗しました');
			window.location.href = d.url;
		} catch (e) { errMsg = e.message; busy = false; }
	}

	async function openPortal() {
		errMsg = ''; busy = true;
		try {
			const res = await fetch('/api/subscription/portal', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
				body: JSON.stringify({})
			});
			const d = await res.json().catch(() => ({}));
			if (!res.ok || !d.url) throw new Error(d.message ?? 'お支払い管理ページを開けませんでした');
			window.location.href = d.url;
		} catch (e) { errMsg = e.message; busy = false; }
	}

	let isActive = $derived(profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing');
	let statusLabel = $derived(
		profile?.subscription_status === 'active' ? '利用中'
		: profile?.subscription_status === 'trialing' ? 'お試し中'
		: profile?.subscription_status === 'past_due' ? 'お支払い確認中'
		: profile?.subscription_status === 'canceled' ? '解約済み'
		: '未申し込み'
	);
</script>

<div class="page">
	<div class="page-nav">
		<a class="back" href="{base}/mypage">← マイページに戻る</a>
	</div>

	{#if isLoading}
		<p class="loading">読み込み中…</p>
	{:else}
		<header class="head">
			<span class="kicker"><Icon name="badge-check" size={16} /> 法人ダッシュボード</span>
			<h1 class="title">{profile.corp_name || profile.name || '法人アカウント'}</h1>
		</header>

		{#if errMsg}<p class="error-msg">{errMsg}</p>{/if}
		{#if saveMsg}<p class="save-msg">{saveMsg}</p>{/if}

		<!-- プラン状態 -->
		<section class="card">
			<h2 class="card-title">プランの状態</h2>
			<div class="status-row">
				<span class="status-chip" class:on={isActive}>{statusLabel}</span>
				{#if isActive}
					<span class="status-note">夜行人図鑑に広告が掲載され、法人バッジが表示されています。</span>
				{:else}
					<span class="status-note">月額プランにお申し込みいただくと広告掲載が始まります。</span>
				{/if}
			</div>
			<div class="card-actions">
				{#if isActive}
					<button class="btn ghost" onclick={openPortal} disabled={busy}>お支払い・プランの管理（解約）</button>
				{:else}
					<button class="btn" onclick={subscribe} disabled={busy}>法人プランに申し込む（月額）</button>
				{/if}
			</div>
		</section>

		<!-- 広告編集 -->
		<section class="card">
			<h2 class="card-title">広告の内容</h2>
			<p class="card-hint">ここで作成した内容は、夜行人図鑑であなたのアイコンをクリックしたときに表示されます。契約中は放浪者として図鑑の中を巡回します。</p>

			<label class="field">
				<span class="field-label">キャッチコピー <span class="muted">（全角30字まで）</span></span>
				<input type="text" class="input" bind:value={headline} maxlength="60" placeholder="例: 京都の夜に、あたたかい一杯を。" />
			</label>

			<label class="field">
				<span class="field-label">オンラインストアURL</span>
				<input type="url" class="input" bind:value={storeUrl} placeholder="https://…" />
			</label>

			<label class="field">
				<span class="field-label">求人・採用URL</span>
				<input type="url" class="input" bind:value={recruitUrl} placeholder="https://…" />
			</label>

			<div class="field">
				<span class="field-label">広告画像（1枚）</span>
				{#if adImagePreview}
					<img src={adImagePreview} alt="広告画像プレビュー" class="ad-preview" />
				{/if}
				<label class="file-btn">
					<Icon name="image" size={16} /> 画像を選ぶ
					<input type="file" accept="image/*" onchange={onImagePick} hidden />
				</label>
			</div>

			<div class="card-actions">
				<button class="btn" onclick={saveAd} disabled={busy}>広告を保存</button>
				<a class="btn ghost" href="{base}/network">図鑑で確認する</a>
			</div>
		</section>
	{/if}
</div>

<style>
	.page { max-width: 640px; margin: 0 auto; padding: 20px 20px 80px; box-sizing: border-box; }
	.page-nav { margin-bottom: 20px; }
	.back { display: inline-flex; align-items: center; gap: 4px; font-size: 0.85rem; color: var(--ink-2); text-decoration: none; }
	.back:hover { color: var(--ink); }
	.loading { text-align: center; color: var(--ink-3); padding: 60px 0; }

	.head { margin-bottom: 24px; }
	.kicker { display: inline-flex; align-items: center; gap: 6px; font-size: 0.72rem; letter-spacing: 0.2em; color: #8a6a1e; }
	.title { font-family: "Zen Antique", serif; font-size: 1.5rem; letter-spacing: 0.06em; color: var(--ink); margin: 6px 0 0; }

	.error-msg { background: #fef2f2; color: var(--accent-deep); border: 1px solid #fecaca; border-radius: 10px; padding: 10px 14px; font-size: 0.85rem; margin: 0 0 14px; }
	.save-msg  { background: #ecfdf5; color: #14532d; border: 1px solid #bbf7d0; border-radius: 10px; padding: 10px 14px; font-size: 0.85rem; margin: 0 0 14px; }

	.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg, 16px); padding: 20px; margin-bottom: 18px; box-shadow: var(--shadow-1); }
	.card-title { font-size: 1rem; font-weight: 700; color: var(--ink); margin: 0 0 8px; }
	.card-hint { font-size: 0.82rem; color: var(--ink-2); line-height: 1.7; margin: 0 0 16px; }

	.status-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
	.status-chip { font-size: 0.8rem; font-weight: 700; padding: 4px 12px; border-radius: 20px; background: var(--surface-sunk); color: var(--ink-2); border: 1px solid var(--line); }
	.status-chip.on { background: rgba(181,137,46,0.14); color: #8a6a1e; border-color: rgba(181,137,46,0.4); }
	.status-note { font-size: 0.82rem; color: var(--ink-2); }

	.field { display: block; margin-bottom: 16px; }
	.field-label { display: block; font-size: 0.82rem; font-weight: 600; color: var(--ink); margin-bottom: 6px; }
	.muted { color: var(--ink-3); font-weight: 400; }
	.input { width: 100%; box-sizing: border-box; padding: 10px 14px; border: 1px solid var(--line-strong); border-radius: 10px; font-size: 0.95rem; font-family: inherit; background: var(--surface); color: var(--ink); }
	.input:focus { outline: 2px solid var(--accent); border-color: transparent; }

	.ad-preview { display: block; width: 100%; max-height: 200px; object-fit: cover; border-radius: 10px; border: 1px solid var(--line); margin-bottom: 10px; }
	.file-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--ink); background: var(--surface-sunk); border: 1px solid var(--line); border-radius: 8px; padding: 8px 14px; cursor: pointer; }
	.file-btn:hover { background: #ede8e2; }

	.card-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
	.btn { display: inline-flex; align-items: center; justify-content: center; padding: 10px 18px; border-radius: 10px; font-size: 0.9rem; font-weight: 600; font-family: inherit; cursor: pointer; border: none; background: var(--accent); color: #fff; text-decoration: none; }
	.btn:hover:not(:disabled) { background: var(--accent-deep); }
	.btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.btn.ghost { background: none; border: 1px solid var(--line-strong); color: var(--ink); }
	.btn.ghost:hover:not(:disabled) { background: var(--surface-sunk); }
</style>
