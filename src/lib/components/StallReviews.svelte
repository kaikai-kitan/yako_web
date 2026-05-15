<script>
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase.js';

	let { stallId } = $props();

	let reviews = $state([]);
	let isLoading = $state(true);
	let canReview = $state(false);
	let myReview = $state(null); // 自分の既存レビュー
	let currentUserId = $state(null);
	let accessToken = $state('');

	// 投稿フォーム
	let formRating = $state(0);
	let hoverRating = $state(0);
	let formComment = $state('');
	let isSubmitting = $state(false);
	let submitMsg = $state('');
	let submitError = $state('');

	onMount(async () => {
		const { data: { session } } = await supabase.auth.getSession();
		currentUserId = session?.user?.id ?? null;
		accessToken = session?.access_token ?? '';

		await loadReviews();

		if (currentUserId) {
			// この屋台の完了済み予約があるか確認（レビュー投稿資格）
			const { count } = await supabase
				.from('reservations')
				.select('id', { count: 'exact', head: true })
				.eq('user_id', currentUserId)
				.eq('stall_id', stallId)
				.eq('status', 'completed');
			canReview = (count ?? 0) >= 1;

			if (canReview) {
				myReview = reviews.find((r) => r.user_id === currentUserId) ?? null;
				if (myReview) {
					formRating = myReview.rating;
					formComment = myReview.comment ?? '';
				}
			}
		}

		isLoading = false;
	});

	async function loadReviews() {
		const { data } = await supabase
			.from('stall_reviews')
			.select('id, user_id, rating, comment, created_at, user_profiles(name, icon_path)')
			.eq('stall_id', stallId)
			.order('created_at', { ascending: false });
		reviews = data ?? [];
	}

	async function submitReview() {
		if (formRating < 1) { submitError = '星を選択してください'; return; }
		isSubmitting = true;
		submitError = '';
		try {
			const res = await fetch('/api/reviews', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`
				},
				body: JSON.stringify({ stallId, rating: formRating, comment: formComment })
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.message ?? 'レビューの投稿に失敗しました');
			}
			submitMsg = myReview ? 'レビューを更新しました' : 'レビューを投稿しました';
			await loadReviews();
			myReview = reviews.find((r) => r.user_id === currentUserId) ?? null;
			setTimeout(() => (submitMsg = ''), 3000);
		} catch (e) {
			submitError = e.message;
		}
		isSubmitting = false;
	}

	function avgRating() {
		if (reviews.length === 0) return 0;
		return Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10;
	}

	function fmtDate(iso) {
		return new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
	}
</script>

<div class="reviews-section">
	<div class="reviews-header">
		<h3 class="reviews-title">レビュー</h3>
		{#if reviews.length > 0}
			<span class="avg-badge">★ {avgRating()} ({reviews.length}件)</span>
		{/if}
	</div>

	<!-- レビュー投稿フォーム -->
	{#if !isLoading && canReview}
		<div class="review-form">
			<p class="review-disclaimer">
				※ レビュー内容は運営の出品審査に影響します。正確な情報をご記入ください。
			</p>
			<div class="star-row">
				{#each [1,2,3,4,5] as n}
					<button
						class="star-btn"
						class:filled={n <= (hoverRating || formRating)}
						onmouseenter={() => (hoverRating = n)}
						onmouseleave={() => (hoverRating = 0)}
						onclick={() => (formRating = n)}
						type="button"
						aria-label="{n}つ星"
					>★</button>
				{/each}
				{#if formRating > 0}
					<span class="star-label">{formRating}/5</span>
				{/if}
			</div>
			<textarea
				class="comment-input"
				bind:value={formComment}
				placeholder="利用した感想を書いてください（任意）"
				rows="3"
			></textarea>
			{#if submitMsg}
				<p class="submit-msg success">{submitMsg}</p>
			{/if}
			{#if submitError}
				<p class="submit-msg error">{submitError}</p>
			{/if}
			<button class="submit-btn" onclick={submitReview} disabled={isSubmitting}>
				{isSubmitting ? '投稿中…' : myReview ? 'レビューを更新' : 'レビューを投稿'}
			</button>
		</div>
	{/if}

	<!-- レビュー一覧 -->
	{#if isLoading}
		<p class="loading-text">読み込み中…</p>
	{:else if reviews.length === 0}
		<p class="no-reviews">まだレビューはありません。</p>
	{:else}
		<div class="review-list">
			{#each reviews as review}
				<div class="review-item" class:own={review.user_id === currentUserId}>
					<div class="review-top">
						<div class="reviewer-info">
							{#if review.user_profiles?.icon_path}
								<img src={review.user_profiles.icon_path} alt="" class="reviewer-icon" />
							{:else}
								<div class="reviewer-icon placeholder">👤</div>
							{/if}
							<span class="reviewer-name">
								{review.user_profiles?.name ?? '匿名'}
								{#if review.user_id === currentUserId}
									<span class="own-badge">あなた</span>
								{/if}
							</span>
						</div>
						<div class="review-meta">
							<span class="review-stars">{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</span>
							<span class="review-date">{fmtDate(review.created_at)}</span>
						</div>
					</div>
					{#if review.comment}
						<p class="review-comment">{review.comment}</p>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.reviews-section {
		margin-top: 32px;
		padding-top: 24px;
		border-top: 1px solid #f0ede8;
	}
	.reviews-header {
		display: flex; align-items: center; gap: 10px; margin-bottom: 16px;
	}
	.reviews-title {
		font-size: 1rem; font-weight: 700; color: #26201a; margin: 0;
	}
	.avg-badge {
		font-size: 0.82rem; background: #fef9f0;
		color: #d56d04; border: 1px solid #fde68a;
		border-radius: 20px; padding: 2px 10px; font-weight: 600;
	}

	/* 投稿フォーム */
	.review-form {
		background: #faf8f5; border-radius: 14px;
		padding: 16px; margin-bottom: 20px;
		border: 1px solid #f0ede8;
	}
	.review-disclaimer {
		font-size: 0.75rem; color: #c62828;
		background: #fef2f2; border-radius: 6px;
		padding: 6px 10px; margin: 0 0 12px;
		border-left: 3px solid #fca5a5;
	}
	.star-row {
		display: flex; align-items: center; gap: 4px; margin-bottom: 10px;
	}
	.star-btn {
		font-size: 1.6rem; background: none; border: none;
		cursor: pointer; padding: 0; line-height: 1;
		color: #e8e0d8; transition: color 0.1s;
	}
	.star-btn.filled { color: #f59e0b; }
	.star-label { font-size: 0.82rem; color: #7a6f67; margin-left: 4px; }
	.comment-input {
		width: 100%; box-sizing: border-box;
		border: 1.5px solid #e8e0d8; border-radius: 10px;
		padding: 9px 12px; font-size: 0.88rem;
		font-family: inherit; resize: vertical; outline: none;
		margin-bottom: 10px;
	}
	.comment-input:focus { border-color: #d56d04; }
	.submit-msg { font-size: 0.82rem; margin: 0 0 8px; }
	.submit-msg.success { color: #166534; }
	.submit-msg.error { color: #991b1b; }
	.submit-btn {
		width: 100%; padding: 10px;
		background: #26201a; color: white;
		border: none; border-radius: 10px;
		font-size: 0.88rem; font-weight: 700;
		font-family: inherit; cursor: pointer;
	}
	.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

	/* レビュー一覧 */
	.loading-text, .no-reviews {
		color: #9e9289; font-size: 0.88rem; text-align: center; padding: 20px 0;
	}
	.review-list { display: flex; flex-direction: column; gap: 12px; }
	.review-item {
		background: white; border-radius: 12px;
		padding: 14px; border: 1px solid #f0ede8;
	}
	.review-item.own { border-color: #fde68a; background: #fffbeb; }
	.review-top {
		display: flex; justify-content: space-between;
		align-items: flex-start; margin-bottom: 6px; flex-wrap: wrap; gap: 4px;
	}
	.reviewer-info { display: flex; align-items: center; gap: 8px; }
	.reviewer-icon {
		width: 28px; height: 28px; border-radius: 50%;
		object-fit: cover;
	}
	.reviewer-icon.placeholder {
		display: flex; align-items: center; justify-content: center;
		background: #f0ede8; font-size: 0.9rem;
	}
	.reviewer-name { font-size: 0.85rem; font-weight: 600; color: #26201a; }
	.own-badge {
		font-size: 0.65rem; background: #fde68a; color: #92400e;
		border-radius: 4px; padding: 1px 5px; margin-left: 4px; font-weight: 700;
	}
	.review-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
	.review-stars { color: #f59e0b; font-size: 0.85rem; letter-spacing: 0.05em; }
	.review-date { font-size: 0.72rem; color: #9e9289; }
	.review-comment { font-size: 0.85rem; color: #5a5250; line-height: 1.6; margin: 0; }
</style>
