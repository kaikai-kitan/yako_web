import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const prerender = false;

const FROM_EMAIL = 'onboarding@resend.dev';

export async function POST({ request }) {
	// JWT 認証
	const authHeader = request.headers.get('authorization') ?? '';
	const token = authHeader.replace('Bearer ', '').trim();
	if (!token) throw error(401, 'Unauthorized');

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

	const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
	if (authErr || !user) throw error(401, 'Unauthorized');

	let body;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const { orderId, trackingNumber } = body;
	if (!orderId) throw error(400, 'orderId is required');

	// 注文取得 + 出店者確認（自分の注文のみ操作可）
	const { data: order, error: orderErr } = await supabase
		.from('shop_orders')
		.select('id, operator_id, customer_email, items, shipping_address, shipping_status')
		.eq('id', orderId)
		.single();

	if (orderErr || !order) throw error(404, 'Order not found');
	if (order.operator_id !== user.id) throw error(403, 'Forbidden');
	if (order.shipping_status === 'shipped' || order.shipping_status === 'delivered') {
		throw error(409, 'Already shipped');
	}

	// 発送済みに更新
	const { error: updateErr } = await supabase
		.from('shop_orders')
		.update({
			shipping_status: 'shipped',
			tracking_number: trackingNumber?.trim() || null
		})
		.eq('id', orderId);

	if (updateErr) throw error(500, 'Failed to update order');

	// 購入者へ発送通知メール
	if (order.customer_email && env.RESEND_API_KEY) {
		try {
			const resend = new Resend(env.RESEND_API_KEY);
			const trackingNote = trackingNumber
				? `<p style="margin:8px 0">追跡番号: <strong>${trackingNumber}</strong></p>`
				: '';

			const itemRows = (order.items ?? [])
				.map(
					(i) => `<tr>
					<td style="padding:6px 12px;border-bottom:1px solid #f0ede8">${i.name}</td>
					<td style="padding:6px 12px;border-bottom:1px solid #f0ede8;text-align:center">${i.quantity}</td>
				</tr>`
				)
				.join('');

			await resend.emails.send({
				from: FROM_EMAIL,
				to: order.customer_email,
				subject: '【微小夜行電灯】ご注文商品を発送しました',
				html: `
					<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#26201a">
						<h2 style="background:#fbf3ea;padding:16px 20px;margin:0;font-size:1rem;border-left:4px solid #d56d04">
							ご注文商品を発送しました
						</h2>
						<div style="padding:20px">
							<p>ご注文ありがとうございます。商品を発送いたしました。</p>
							${trackingNote}
							<table style="width:100%;border-collapse:collapse;font-size:0.9rem;margin-top:12px">
								<thead>
									<tr style="background:#f8f5f0">
										<th style="padding:6px 12px;text-align:left">商品名</th>
										<th style="padding:6px 12px">数量</th>
									</tr>
								</thead>
								<tbody>${itemRows}</tbody>
							</table>
							<p style="font-size:0.82rem;color:#7a6f67;margin-top:20px">
								商品のお届けまで今しばらくお待ちください。<br/>
								お問い合わせは <a href="mailto:delta10yako@gmail.com">delta10yako@gmail.com</a> まで。
							</p>
						</div>
					</div>
				`
			});
		} catch (e) {
			console.error('Shipping notification email error:', e);
		}
	}

	return json({ ok: true });
}
