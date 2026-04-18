import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

export async function POST({ request }) {
	try {
		const body = await request.json();
		const { reservationId, userId, successUrl, cancelUrl } = body;

		if (!reservationId || !userId) throw error(400, '必須パラメータが不足しています');

		const stripeKey = env.STRIPE_SECRET_KEY;
		if (!stripeKey) throw error(500, 'STRIPE_SECRET_KEY が未設定です');

		const supabaseUrl = env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
		const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
		if (!supabaseUrl || !serviceKey) throw error(500, 'Supabase設定が未設定です');

		const supabase = createClient(supabaseUrl, serviceKey);

		// 予約詳細を取得（料金計算のため）
		const { data: res, error: dbErr } = await supabase
			.from('reservations')
			.select(`
				id, start_datetime, end_datetime, user_id,
				stall_specs ( stall_name, rental_fee ),
				rental_spaces ( name, space_fee )
			`)
			.eq('id', reservationId)
			.eq('status', 'pending')
			.single();

		if (dbErr || !res) throw error(404, '有効な予約が見つかりません');
		if (res.user_id !== userId) throw error(403, '権限がありません');

		// 利用日数を計算（最低1日）
		const days = Math.max(1, Math.ceil(
			(new Date(res.end_datetime) - new Date(res.start_datetime)) / (1000 * 60 * 60 * 24)
		));

		const stallFee = (res.stall_specs?.rental_fee ?? 0) * days;
		const spaceFee = (res.rental_spaces?.space_fee ?? 0) * days;
		const total = stallFee + spaceFee;

		// 合計0円の場合は無料でアクティブ化
		if (total === 0) {
			await supabase.from('reservations').update({ status: 'active' }).eq('id', reservationId);
			return json({ free: true });
		}

		const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
		const lineItems = [];

		if (stallFee > 0) {
			lineItems.push({
				price_data: {
					currency: 'jpy',
					product_data: {
						name: `屋台利用料: ${res.stall_specs?.stall_name ?? ''}（${days}日分）`
					},
					unit_amount: stallFee
				},
				quantity: 1
			});
		}
		if (spaceFee > 0) {
			lineItems.push({
				price_data: {
					currency: 'jpy',
					product_data: {
						name: `スペース利用料: ${res.rental_spaces?.name ?? ''}（${days}日分）`
					},
					unit_amount: spaceFee
				},
				quantity: 1
			});
		}

		const session = await stripe.checkout.sessions.create({
			payment_method_types: ['card'],
			line_items: lineItems,
			mode: 'payment',
			success_url: successUrl,
			cancel_url: cancelUrl,
			metadata: { type: 'rental', reservationId, userId },
			locale: 'ja'
		});

		return json({ url: session.url, sessionId: session.id });

	} catch (err) {
		if (err?.status) throw err;
		console.error('[create-rental-checkout]', err);
		throw error(500, err?.message ?? String(err));
	}
}
