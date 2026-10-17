import { isRentalConfirmed } from '$lib/rental-payment.js';
import { BILLING_FIELDS, secureRentalAtCheckIn, reservedAmount } from '$lib/server/rental-billing.js';
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
		.select(BILLING_FIELDS)
		.eq('id', reservationId)
		.single();

	if (resErr || !reservation) throw error(404, '予約が見つかりません');
	if (reservation.user_id !== user.id) throw error(403, 'Forbidden');
	if (reservation.status !== 'pending') {
		throw error(400, `この予約はチェックインできません（ステータス: ${reservation.status}）`);
	}

	if (!isRentalConfirmed(reservation)) throw error(402, 'カードの確認が未完了です。予約手続きを完了してください。');

	// 予約時間分の仮押さえ（新方式）／予約時の与信の確定（旧方式）
	const stripeKey = env.STRIPE_SECRET_KEY;
	if (stripeKey) {
		const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
		await secureRentalAtCheckIn({ stripe, supabase, reservation });
	} else if (reservedAmount(reservation) > 0) {
		throw error(500, '決済設定が未設定です');
	}

	// 予約を利用中（active）に更新
	const { error: updateErr } = await supabase
		.from('reservations')
		.update({ status: 'active' })
		.eq('id', reservationId)
		.eq('status', 'pending'); // 競合防止

	if (updateErr) throw error(500, 'チェックイン処理に失敗しました');

	return json({ success: true });
}
