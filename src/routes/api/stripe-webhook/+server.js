import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const prerender = false;

/** 事業者向け注文通知メール（個人情報は配送に必要な最小限のみ） */
async function sendOrderNotification({ items, totalAmount, shipping, orderId }) {
	const apiKey = env.RESEND_API_KEY;
	const operatorEmail = env.OPERATOR_EMAIL;
	if (!apiKey || !operatorEmail) return;

	const resend = new Resend(apiKey);

	const itemRows = items
		.map((i) => `<tr>
			<td style="padding:6px 12px;border-bottom:1px solid #f0ede8">${i.name}</td>
			<td style="padding:6px 12px;border-bottom:1px solid #f0ede8;text-align:center">${i.quantity}</td>
			<td style="padding:6px 12px;border-bottom:1px solid #f0ede8;text-align:right">¥${(i.price * i.quantity).toLocaleString()}</td>
		</tr>`)
		.join('');

	const addr = shipping?.address ?? {};
	const shippingHtml = shipping
		? `<p style="margin:0">
				〒${addr.postal_code ?? ''} ${addr.state ?? ''}${addr.city ?? ''}${addr.line1 ?? ''}${addr.line2 ? ' ' + addr.line2 : ''}<br/>
				お名前: ${shipping.name ?? ''}
			</p>`
		: '<p style="color:#999">配送先情報なし</p>';

	await resend.emails.send({
		from: 'noreply@yako-web.vercel.app',
		to: operatorEmail,
		subject: `【微小夜行電灯】新規注文 #${orderId.slice(-8).toUpperCase()}`,
		html: `
			<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#26201a">
				<h2 style="background:#fbf3ea;padding:16px 20px;margin:0;font-size:1rem;border-left:4px solid #d56d04">
					新規注文が入りました
				</h2>
				<div style="padding:20px">
					<h3 style="font-size:0.9rem;color:#7a6f67;margin:0 0 8px">注文商品</h3>
					<table style="width:100%;border-collapse:collapse;font-size:0.9rem">
						<thead>
							<tr style="background:#f8f5f0">
								<th style="padding:6px 12px;text-align:left">商品名</th>
								<th style="padding:6px 12px">数量</th>
								<th style="padding:6px 12px;text-align:right">金額</th>
							</tr>
						</thead>
						<tbody>${itemRows}</tbody>
						<tfoot>
							<tr>
								<td colspan="2" style="padding:8px 12px;font-weight:bold">合計</td>
								<td style="padding:8px 12px;font-weight:bold;text-align:right">¥${totalAmount.toLocaleString()}</td>
							</tr>
						</tfoot>
					</table>

					<h3 style="font-size:0.9rem;color:#7a6f67;margin:20px 0 8px">配送先</h3>
					<div style="background:#f8f5f0;padding:12px 16px;border-radius:8px;font-size:0.9rem;line-height:1.8">
						${shippingHtml}
					</div>

					<p style="font-size:0.78rem;color:#94a3b8;margin-top:20px;padding-top:16px;border-top:1px solid #f0ede8">
						※ このメールには配送に必要な情報のみ含まれています。<br/>
						顧客のメールアドレス・電話番号は管理画面からご確認ください。<br/>
						注文ID: ${orderId}
					</p>
				</div>
			</div>
		`
	});
}

export async function POST({ request }) {
	const stripe = new Stripe(env.STRIPE_SECRET_KEY);
	const body = await request.text();
	const sig = request.headers.get('stripe-signature');

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
				// レンタル決済: 予約をアクティブ化
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

				// Stripeが収集した配送先住所
				const shipping = session.shipping_details ?? null;

				const { error } = await supabase.from('shop_orders').upsert(
					{
						stripe_session_id: session.id,
						stripe_payment_intent_id: session.payment_intent,
						user_id: metadata?.userId || null,
						items,
						total_amount: session.amount_total,
						status: 'paid',
						customer_email: session.customer_details?.email ?? null,
						shipping_address: shipping
							? {
									name:        shipping.name,
									postal_code: shipping.address?.postal_code,
									state:       shipping.address?.state,
									city:        shipping.address?.city,
									line1:       shipping.address?.line1,
									line2:       shipping.address?.line2 ?? null,
									phone:       session.customer_details?.phone ?? null
								}
							: null
					},
					{ onConflict: 'stripe_session_id' }
				);
				if (error) console.error('Order upsert error:', error);

				// 事業者へメール通知
				try {
					await sendOrderNotification({
						items,
						totalAmount: session.amount_total,
						shipping,
						orderId: session.id
					});
				} catch (e) {
					console.error('Order notification email error:', e);
				}
			}
		}
	}

	return new Response('OK', { status: 200 });
}
