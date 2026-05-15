import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

export async function POST({ request }) {
	try {
		const { sessionId, reservationId, userId } = await request.json();

		if (!sessionId || !reservationId) throw error(400, '必須パラメータが不足しています');

		const stripeKey = env.STRIPE_SECRET_KEY;
		if (!stripeKey) throw error(500, 'STRIPE_SECRET_KEY が未設定です');

		// Stripe で与信確保が完了しているか確認
		const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
		const session = await stripe.checkout.sessions.retrieve(sessionId);

		// payment_status === 'paid' は auth-only（requires_capture）でも成立する
		if (session.payment_status !== 'paid') {
			throw error(402, '与信確保が完了していません');
		}
		if (session.metadata?.reservationId !== reservationId) {
			throw error(400, '予約情報が一致しません');
		}

		const paymentIntentId = session.payment_intent;
		if (!paymentIntentId) throw error(400, '支払い情報が見つかりません');

		const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

		// PaymentIntent ID を予約に保存する（status は pending のまま）
		// 実際の引き落とし（Capture）は QR チェックイン時に /api/checkin-rental で実行
		const { error: dbErr } = await supabase
			.from('reservations')
			.update({ stripe_payment_intent_id: paymentIntentId })
			.eq('id', reservationId)
			.in('status', ['pending']);

		if (dbErr) throw error(500, 'DB の更新に失敗しました: ' + dbErr.message);

		return json({ authorized: true, paymentIntentId });

	} catch (err) {
		if (err?.status) throw err;
		console.error('[activate-rental]', err);
		throw error(500, err?.message ?? String(err));
	}
}
