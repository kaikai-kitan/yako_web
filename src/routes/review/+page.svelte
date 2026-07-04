<!-- 営業レビュー（顧客が5段階評価。匿名） -->
<script>
	import { onMount } from 'svelte';
	import { base } from '$app/paths';

	/** @type {'form'|'sending'|'done'|'error'} */
	let phase = $state('form');
	let reservationId = '';
	let rating = $state(0);
	let hover = $state(0);
	let comment = $state('');
	let errorMsg = $state('');
	let stallName = $state('');

	onMount(async () => {
		const params = new URLSearchParams(window.location.search);
		reservationId = params.get('op') ?? '';
		if (!reservationId) { phase = 'error'; errorMsg = '無効なレビューリンクです。'; return; }

		// 屋台名の表示（任意・公開情報）
		try {
			const { supabase } = await import('$lib/supabase.js');
			const { data } = await supabase
				.from('reservations')
				.select('stall_specs ( stall_name )')
				.eq('id', reservationId)
				.maybeSingle();
			stallName = data?.stall_specs?.stall_name ?? '';
		} catch { /* noop */ }
	});

	function reviewerToken() {
		const KEY = 'op_review_token';
		let t = localStorage.getItem(KEY);
		if (!t) { t = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(KEY, t); }
		return t;
	}

	async function submit() {
		if (rating < 1) { errorMsg = '星を選んでください'; return; }
		phase = 'sending';
		errorMsg = '';
		try {
			const res = await fetch('/api/operation/review', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ reservationId, rating, comment, token: reviewerToken() })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				phase = 'error';
				errorMsg = data.message ?? 'レビューの送信に失敗しました。';
				return;
			}
			phase = 'done';
		} catch (e) {
			phase = 'error';
			errorMsg = '通信に失敗しました: ' + e.message;
		}
	}
</script>

<svelte:head><title>屋台のレビュー | 微小夜行電灯</title></svelte:head>

<div class="wrap">
	<div class="card">
		{#if phase === 'done'}
			<p class="lantern">🏮</p>
			<h1 class="title">ありがとうございました</h1>
			<p class="lead">レビューを受け付けました。<br />またのお越しをお待ちしています。</p>
		{:else if phase === 'error'}
			<h1 class="title">レビューできませんでした</h1>
			<p class="lead">{errorMsg}</p>
		{:else}
			<p class="kicker">屋 台 の レ ビ ュ ー</p>
			<h1 class="title">{stallName || 'この屋台'}はいかがでしたか</h1>

			<div class="stars" role="radiogroup" aria-label="5段階評価">
				{#each [1, 2, 3, 4, 5] as n}
					<button
						type="button"
						class="star"
						class:on={(hover || rating) >= n}
						onmouseenter={() => (hover = n)}
						onmouseleave={() => (hover = 0)}
						onclick={() => (rating = n)}
						aria-label="{n}つ星"
					>★</button>
				{/each}
			</div>

			<textarea class="comment" bind:value={comment} rows="3" maxlength="300"
				placeholder="感想があれば（任意）"></textarea>

			{#if errorMsg}<p class="err">{errorMsg}</p>{/if}

			<button class="submit" onclick={submit} disabled={phase === 'sending' || rating < 1}>
				{phase === 'sending' ? '送信中…' : 'レビューを送る'}
			</button>
			<p class="note">お名前や連絡先は不要です。評価は匿名で記録されます。</p>
		{/if}
	</div>
</div>

<style>
	.wrap { min-height: 80svh; display: flex; align-items: center; justify-content: center; padding: 24px; background: var(--paper); }
	.card {
		width: 100%; max-width: 380px; background: var(--surface); border: 1px solid var(--line);
		border-radius: var(--r-lg); padding: 32px 26px; text-align: center; box-shadow: var(--shadow-1);
	}
	.lantern { font-size: 2.6rem; margin: 0 0 8px; }
	.kicker { font-size: 0.68rem; letter-spacing: 0.4em; color: var(--ink-3); margin: 0 0 12px; }
	.title { font-family: "Zen Antique", serif; font-size: 1.2rem; letter-spacing: 0.06em; color: var(--ink); margin: 0 0 8px; line-height: 1.5; }
	.lead { font-size: 0.9rem; color: var(--ink-2); line-height: 1.7; margin: 0; }

	.stars { display: flex; justify-content: center; gap: 6px; margin: 22px 0 18px; }
	.star {
		background: none; border: none; cursor: pointer; font-size: 2.4rem; line-height: 1;
		color: #ddd2bf; transition: color 0.12s, transform 0.12s; padding: 0;
	}
	.star.on { color: #e0a72e; }
	.star:hover { transform: scale(1.1); }

	.comment {
		width: 100%; box-sizing: border-box; border: 1px solid var(--line-strong); border-radius: var(--r-md);
		padding: 11px 13px; font-size: 0.92rem; font-family: inherit; color: var(--ink); background: var(--paper);
		resize: vertical;
	}
	.comment:focus { outline: none; border-color: var(--accent); }

	.err { color: #b0402c; font-size: 0.84rem; margin: 12px 0 0; }
	.submit {
		width: 100%; margin-top: 16px; padding: 13px; border: none; border-radius: var(--r-md);
		background: var(--accent); color: #fff; font-family: "Zen Antique", serif; font-size: 0.95rem;
		letter-spacing: 0.08em; cursor: pointer; transition: background 0.15s;
	}
	.submit:hover:not(:disabled) { background: var(--accent-deep); }
	.submit:disabled { opacity: 0.5; cursor: default; }
	.note { font-size: 0.72rem; color: var(--ink-3); margin: 14px 0 0; line-height: 1.6; }
</style>
