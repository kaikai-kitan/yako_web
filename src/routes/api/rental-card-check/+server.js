import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { requireRentalUser } from '$lib/server/rental-authorization.js';
import { BILLING_FIELDS, getOrCreateCustomer, reservedAmount } from '$lib/server/rental-billing.js';
import { isRentalConfirmed } from '$lib/rental-payment.js';

export const prerender = false;

/**
 * チェックイン時に登録カードの仮押さえができなかった場合の、カードの確認し直し。
 * Stripe Checkout（payment モード・手動確定）で予約時間分を仮押さえし、カードも保存する。
 * 戻ってきたら、もう一度QRをスキャンしてチェックインする。
 * POST { reservationId } → { url }
 */
export async function POST({ request }) {
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const user = await requireRentalUser(supabase, request);
	const { reservationId } = await request.json().catch(() => ({}));
	if (!reservationId) error(400, 'reservationId が必要です');
	if (!env.STRIPE_SECRET_KEY) error(500, '決済設定が未設定です');

	const { data: res, error: resError } = await supabase
		.from('reservations')
		.select(BILLING_FIELDS)
		.eq('id', reservationId)
		.maybeSingle();
	if (resError) error(500, '予約情報を取得できませんでした');
	if (!res) error(404, '予約が見つかりません');
	if (res.user_id !== user.id) error(403, '権限がありません');
	if (res.status !== 'pending' || !isRentalConfirmed(res)) error(409, 'この予約ではカードの確認は不要です');

	const amount = reservedAmount(res);
	if (amount === 0) error(409, 'この予約ではカードの確認は不要です');

	const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
	const customerId = res.stripe_customer_id || (await getOrCreateCustomer({ stripe, supabase, user }));
	const origin = new URL(request.url).origin;
	const session = await stripe.checkout.sessions.create({
		mode: 'payment',
		customer: customerId,
		payment_method_types: ['card'],
		line_items: [
			{
				price_data: { currency: 'jpy', product_data: { name: '屋台レンタル（予約時間分の仮押さえ）' }, unit_amount: amount },
				quantity: 1
			}
		],
		payment_intent_data: {
			capture_method: 'manual',
			setup_future_usage: 'off_session',
			metadata: { type: 'rental_hold', reservationId }
		},
		metadata: { type: 'rental_hold', reservationId, userId: user.id },
		success_url: `${origin}/map?rental_hold=${reservationId}&session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: `${origin}/map`,
		expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
		locale: 'ja',
		custom_text: {
			submit: { message: '予約時間分を仮押さえします（まだ請求はしません）。返却時に延長分を含めた合計を請求します。' }
		}
	});
	return json({ url: session.url });
}
