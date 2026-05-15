import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

export async function POST({ request }) {
	const authHeader = request.headers.get('Authorization') ?? '';
	const token = authHeader.replace('Bearer ', '').trim();
	if (!token) throw error(401, 'Unauthorized');

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

	const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
	if (authErr || !user) throw error(401, 'Unauthorized');

	const body = await request.json().catch(() => ({}));
	const { reservationId } = body;
	if (!reservationId) throw error(400, 'reservationId is required');

	// 予約を取得（pending のみ対象）
	const { data: reservation, error: resErr } = await supabase
		.from('reservations')
		.select('id, user_id, status, stripe_payment_intent_id')
		.eq('id', reservationId)
		.single();

	if (resErr || !reservation) throw error(404, '予約が見つかりません');
	if (reservation.user_id !== user.id) throw error(403, 'Forbidden');
	if (reservation.status !== 'pending') {
		throw error(400, `この予約はチェックインできません（ステータス: ${reservation.status}）`);
	}

	const piId = reservation.stripe_payment_intent_id;

	if (piId) {
		// --- 有料レンタル: Stripe Capture で売上確定 ---
		const stripeKey = env.STRIPE_SECRET_KEY;
		if (!stripeKey) throw error(500, 'STRIPE_SECRET_KEY が未設定です');

		const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });

		try {
			const pi = await stripe.paymentIntents.capture(piId);
			if (pi.status !== 'succeeded') {
				throw error(402, `決済の確定に失敗しました（Stripe status: ${pi.status}）`);
			}
		} catch (stripeErr) {
			// Stripe エラーを詳細ログ、ユーザーには汎用メッセージ
			console.error('[checkin-rental] Stripe capture failed:', stripeErr);
			throw error(402, '決済の処理に失敗しました。カード情報をご確認の上、再度お試しください。');
		}
	}
	// piId が null の場合は無料レンタル → Stripe 処理不要

	// 予約を利用中（active）に更新
	const { error: updateErr } = await supabase
		.from('reservations')
		.update({ status: 'active' })
		.eq('id', reservationId)
		.eq('status', 'pending'); // 競合防止

	if (updateErr) throw error(500, 'チェックイン処理に失敗しました: ' + updateErr.message);

	return json({ success: true });
}
