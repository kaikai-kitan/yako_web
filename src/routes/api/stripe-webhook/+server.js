import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

export async function POST({ request }) {
	const stripe = new Stripe(env.STRIPE_SECRET_KEY);
	const body = await request.text();
	const sig = request.headers.get('stripe-signature');

	// Webhook シークレットが未設定の場合はスキップ（開発中）
	let event;
	if (env.STRIPE_WEBHOOK_SECRET) {
		try {
			event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET);
		} catch (err) {
			console.error('Webhook signature verification failed:', err.message);
			return new Response(`Webhook Error: ${err.message}`, { status: 400 });
		}
	} else {
		event = JSON.parse(body);
	}

	if (event.type === 'checkout.session.completed') {
		const session = event.data.object;
		const metadata = session.metadata ?? {};

		const supabaseUrl = env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
		const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

		if (supabaseUrl && serviceKey) {
			const supabase = createClient(supabaseUrl, serviceKey);

			if (metadata.type === 'rental' && metadata.reservationId) {
				// レンタル決済: 予約をアクティブ化（冪等性あり）
				const { error } = await supabase
					.from('reservations')
					.update({ status: 'active' })
					.eq('id', metadata.reservationId)
					.in('status', ['pending', 'active']);
				if (error) console.error('Reservation activate error:', error);
			} else {
				// ショップ注文: 注文レコードを記録
				const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
				const items = lineItems.data.map((li) => ({
					name: li.description,
					price: Math.round(li.amount_total / li.quantity),
					quantity: li.quantity
				}));

				const { error } = await supabase.from('shop_orders').upsert(
					{
						stripe_session_id: session.id,
						stripe_payment_intent_id: session.payment_intent,
						user_id: metadata?.userId || null,
						items,
						total_amount: session.amount_total,
						status: 'paid',
						customer_email: session.customer_details?.email ?? null
					},
					{ onConflict: 'stripe_session_id' }
				);
				if (error) console.error('Order upsert error:', error);
			}
		}
	}

	return new Response('OK', { status: 200 });
}
