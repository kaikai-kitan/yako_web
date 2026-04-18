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

		// Stripeで決済が完了しているか確認
		const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
		const session = await stripe.checkout.sessions.retrieve(sessionId);

		if (session.payment_status !== 'paid') throw error(402, '決済が完了していません');
		if (session.metadata?.reservationId !== reservationId) throw error(400, '予約情報が一致しません');

		const supabaseUrl = env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
		const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
		if (!supabaseUrl || !serviceKey) throw error(500, 'Supabase設定が未設定です');

		const supabase = createClient(supabaseUrl, serviceKey);

		// 予約をアクティブ化（冪等性あり: すでにactiveでもOK）
		const { error: dbErr } = await supabase
			.from('reservations')
			.update({ status: 'active' })
			.eq('id', reservationId)
			.in('status', ['pending', 'active']);

		if (dbErr) throw error(500, 'DBの更新に失敗しました: ' + dbErr.message);

		return json({ success: true });

	} catch (err) {
		if (err?.status) throw err;
		console.error('[activate-rental]', err);
		throw error(500, err?.message ?? String(err));
	}
}
