import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

const MAX_REVIEWS = 5;      // 1営業あたりの受付上限
const MAX_REVIEW_CREDIT = 5; // レビューによる加点上限

// 顧客が営業（予約）を5段階評価する（匿名）。営業者の信用スコアに最大 +5。
export async function POST({ request }) {
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

	const body = await request.json().catch(() => ({}));
	const { reservationId, rating, comment, token } = body;

	if (!reservationId) throw error(400, 'reservationId is required');
	const r = Number(rating);
	if (!Number.isInteger(r) || r < 1 || r > 5) throw error(400, '評価は1〜5で選んでください');

	const { data: res } = await supabase
		.from('reservations')
		.select('id, user_id, status, review_count, review_score_accum, review_credit_given')
		.eq('id', reservationId)
		.single();

	if (!res) throw error(404, '営業が見つかりません');
	if (!['active', 'completed'].includes(res.status)) {
		throw error(400, 'この営業は現在レビューを受け付けていません');
	}
	if ((res.review_count ?? 0) >= MAX_REVIEWS) {
		return json({ ok: false, reason: 'full', message: 'この営業のレビューは上限に達しました' }, { status: 409 });
	}

	// レビュー投稿（同一ブラウザの二重投稿は unique 制約で弾く）
	const { error: insErr } = await supabase.from('operation_reviews').insert({
		reservation_id: reservationId,
		rating: r,
		comment: comment?.toString().slice(0, 300) || null,
		reviewer_token: token || null
	});
	if (insErr) {
		if (insErr.code === '23505') {
			return json({ ok: false, reason: 'duplicate', message: 'すでにこの営業を評価済みです' }, { status: 409 });
		}
		throw error(500, insErr.message);
	}

	// 加点の再計算： accum = min(5, Σ rating/5)、加点 = floor(accum)
	const newAccum = Math.min(MAX_REVIEW_CREDIT, (Number(res.review_score_accum) || 0) + r / 5);
	const newGiven = Math.floor(newAccum);
	const delta = newGiven - (res.review_credit_given ?? 0);

	await supabase
		.from('reservations')
		.update({
			review_count: (res.review_count ?? 0) + 1,
			review_score_accum: newAccum,
			review_credit_given: newGiven
		})
		.eq('id', reservationId);

	if (delta > 0) {
		const { data: prof } = await supabase
			.from('user_profiles')
			.select('credit_score')
			.eq('user_id', res.user_id)
			.single();
		const newScore = (prof?.credit_score ?? 100) + delta;
		await supabase.from('user_profiles').update({ credit_score: newScore }).eq('user_id', res.user_id);
	}

	return json({ ok: true, creditAdded: delta });
}
