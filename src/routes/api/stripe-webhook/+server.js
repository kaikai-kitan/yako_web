import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const prerender = false;

const FROM_EMAIL = 'no-reply@delta-yako.com';

/** 管理者向け決済通知メール（全決済共通） */
async function sendAdminNotification({ resend, adminEmails, type, totalAmount, items, customerEmail, orderId }) {
	if (!adminEmails?.length) return;
	const typeLabel = type === 'rental' ? '🏮 屋台レンタル決済' : '🛒 ショップ注文';
	const itemsHtml = (items ?? []).length > 0
		? `<ul style="margin:8px 0;padding-left:20px;font-size:0.9rem">${items.map(i => `<li>${i.name} × ${i.quantity}</li>`).join('')}</ul>`
		: '';

	await resend.emails.send({
		from: FROM_EMAIL,
		to: adminEmails,
		subject: `【微小夜行電灯】${typeLabel} ¥${totalAmount.toLocaleString()} 決済完了`,
		html: `
			<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#26201a">
				<h2 style="background:#fbf3ea;padding:16px 20px;margin:0;font-size:1rem;border-left:4px solid #d56d04">
					${typeLabel}が完了しました
				</h2>
				<div style="padding:20px">
					<table style="width:100%;font-size:0.9rem;border-collapse:collapse">
						<tr><td style="padding:6px 0;color:#7a6f67;width:120px">金額</td><td style="padding:6px 0;font-weight:700">¥${totalAmount.toLocaleString()}</td></tr>
						<tr><td style="padding:6px 0;color:#7a6f67">購入者メール</td><td style="padding:6px 0">${customerEmail ?? '不明'}</td></tr>
						<tr><td style="padding:6px 0;color:#7a6f67">注文ID</td><td style="padding:6px 0;font-size:0.78rem">${orderId}</td></tr>
					</table>
					${itemsHtml}
				</div>
			</div>
		`
	});
}

/** 購入者向け注文確認メール */
async function sendCustomerConfirmation({ resend, toEmail, items, totalAmount, orderId }) {
	if (!toEmail) return;
	const itemRows = (items ?? []).map(i => `
		<tr>
			<td style="padding:6px 12px;border-bottom:1px solid #f0ede8">${i.name}</td>
			<td style="padding:6px 12px;border-bottom:1px solid #f0ede8;text-align:center">${i.quantity}</td>
			<td style="padding:6px 12px;border-bottom:1px solid #f0ede8;text-align:right">¥${(i.price * i.quantity).toLocaleString()}</td>
		</tr>`).join('');

	await resend.emails.send({
		from: FROM_EMAIL,
		to: toEmail,
		subject: '【微小夜行電灯】ご注文ありがとうございます',
		html: `
			<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#26201a">
				<h2 style="background:#fbf3ea;padding:16px 20px;margin:0;font-size:1rem;border-left:4px solid #d56d04">
					ご注文ありがとうございます
				</h2>
				<div style="padding:20px">
					<p>以下の内容でご注文を承りました。発送準備ができ次第ご連絡いたします。</p>
					<table style="width:100%;border-collapse:collapse;font-size:0.9rem;margin-top:8px">
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
					<p style="font-size:0.78rem;color:#94a3b8;margin-top:20px">注文ID: ${orderId}</p>
				</div>
			</div>
		`
	});
}

/** 出店者向け受注通知メール */
async function sendOperatorNotification({ resend, toEmail, items, totalAmount, shipping, orderId }) {
	const itemRows = items
		.map(
			(i) => `<tr>
			<td style="padding:6px 12px;border-bottom:1px solid #f0ede8">${i.name}</td>
			<td style="padding:6px 12px;border-bottom:1px solid #f0ede8;text-align:center">${i.quantity}</td>
			<td style="padding:6px 12px;border-bottom:1px solid #f0ede8;text-align:right">¥${(i.price * i.quantity).toLocaleString()}</td>
		</tr>`
		)
		.join('');

	const addr = shipping?.address ?? {};
	const shippingHtml = shipping
		? `<p style="margin:0">
				〒${addr.postal_code ?? ''} ${addr.state ?? ''}${addr.city ?? ''}${addr.line1 ?? ''}${addr.line2 ? ' ' + addr.line2 : ''}<br/>
				お名前: ${shipping.name ?? ''}
			</p>`
		: '<p style="color:#999">配送先情報なし</p>';

	await resend.emails.send({
		from: FROM_EMAIL,
		to: toEmail,
		subject: `【微小夜行電灯】新規受注 #${orderId.slice(-8).toUpperCase()}`,
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

					<div style="background:#fffbf0;border:1px solid #f5d98a;border-radius:8px;padding:12px 16px;margin-top:16px;font-size:0.85rem">
						<strong>次のステップ</strong><br/>
						商品を発送後、出店者ダッシュボードから「発送済み」に変更してください。購入者へ自動で通知が届きます。
					</div>

					<p style="font-size:0.78rem;color:#94a3b8;margin-top:20px;padding-top:16px;border-top:1px solid #f0ede8">
						※ 購入者のメールアドレス・電話番号は管理画面からご確認ください。<br/>
						注文ID: ${orderId}
					</p>
				</div>
			</div>
		`
	});
}

/** アイコン形状を owned_shapes に追加（重複は無視） */
async function grantShape(supabase, userId, shape) {
	const valid = ['star', 'heart', 'diamond', 'hexagon'];
	if (!valid.includes(shape)) return;
	const { data } = await supabase
		.from('user_profiles')
		.select('owned_shapes')
		.eq('user_id', userId)
		.maybeSingle();
	const owned = Array.isArray(data?.owned_shapes) ? data.owned_shapes : [];
	if (owned.includes(shape)) return;
	const { error } = await supabase
		.from('user_profiles')
		.update({ owned_shapes: [...owned, shape] })
		.eq('user_id', userId);
	if (error) console.error('grant shape error:', error);
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

		if (!supabaseUrl || !serviceKey) {
			return new Response('OK', { status: 200 });
		}

		const supabase = createClient(supabaseUrl, serviceKey);

		const adminEmails = (env.ADMIN_EMAILS ?? '')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
		const customerEmail = session.customer_details?.email ?? null;

		if (metadata.type === 'corporate_subscription' && metadata.userId) {
			// 法人サブスク: 広告表示を有効化
			const { error } = await supabase
				.from('user_profiles')
				.update({
					stripe_customer_id: session.customer ?? null,
					stripe_subscription_id: session.subscription ?? null,
					subscription_status: 'active',
					ad_active: true
				})
				.eq('user_id', metadata.userId);
			if (error) console.error('Corporate subscription activate error:', error);
		} else if (metadata.type === 'icon_shape' && metadata.userId && metadata.shape) {
			// アイコン形状の買い切り: owned_shapes に追加
			await grantShape(supabase, metadata.userId, metadata.shape);
		} else if (metadata.type === 'rental' && metadata.reservationId) {
			// レンタル決済: 予約をアクティブ化
			const { error } = await supabase
				.from('reservations')
				.update({ status: 'active' })
				.eq('id', metadata.reservationId)
				.in('status', ['pending', 'active']);
			if (error) console.error('Reservation activate error:', error);

			// 管理者へ決済通知
			if (resend) {
				try {
					await sendAdminNotification({
						resend,
						adminEmails,
						type: 'rental',
						totalAmount: session.amount_total,
						items: [],
						customerEmail,
						orderId: session.id
					});
				} catch (e) {
					console.error('Admin notification email error:', e);
				}
			}
		} else {
			// ショップ注文: 出店者を特定して受注データを記録
			const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
			const items = lineItems.data.map((li) => ({
				name: li.description,
				price: Math.round(li.amount_total / li.quantity),
				quantity: li.quantity
			}));

			const shipping = session.shipping_details ?? null;

			// メタデータの商品IDから出店者を特定
			let operatorId = null;
			let operatorEmail = null;
			const productIds = (metadata.productIds ?? '')
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean);

			if (productIds.length > 0) {
				const { data: products } = await supabase
					.from('shop_products')
					.select('operator_id, operators(email)')
					.in('id', productIds)
					.not('operator_id', 'is', null)
					.limit(1);

				if (products && products.length > 0) {
					operatorId = products[0].operator_id ?? null;
					operatorEmail = products[0].operators?.email ?? null;
				}
			}

			const { error } = await supabase.from('shop_orders').upsert(
				{
					stripe_session_id: session.id,
					stripe_payment_intent_id: session.payment_intent,
					user_id: metadata?.userId || null,
					operator_id: operatorId,
					items,
					total_amount: session.amount_total,
					status: 'paid',
					shipping_status: 'pending',
					settlement_status: 'unsettled',
					customer_email: customerEmail,
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

			if (resend) {
				// 管理者へ決済通知
				try {
					await sendAdminNotification({
						resend,
						adminEmails,
						type: 'shop',
						totalAmount: session.amount_total,
						items,
						customerEmail,
						orderId: session.id
					});
				} catch (e) {
					console.error('Admin notification email error:', e);
				}

				// 購入者へ注文確認メール
				try {
					await sendCustomerConfirmation({
						resend,
						toEmail: customerEmail,
						items,
						totalAmount: session.amount_total,
						orderId: session.id
					});
				} catch (e) {
					console.error('Customer confirmation email error:', e);
				}

				// 出店者へ受注メール通知
				if (operatorEmail) {
					try {
						await sendOperatorNotification({
							resend,
							toEmail: operatorEmail,
							items,
							totalAmount: session.amount_total,
							shipping,
							orderId: session.id
						});
					} catch (e) {
						console.error('Operator notification email error:', e);
					}
				}
			}
		}
	}

	// --- サブスクの状態変化を広告表示に反映 ---
	if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
		const sub = event.data.object;
		const supabaseUrl = env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
		const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
		if (supabaseUrl && serviceKey) {
			const supabase = createClient(supabaseUrl, serviceKey);
			const status = event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status;
			// active/trialing のときだけ広告表示ON。失効時は一般アカウントとして残す（広告OFF）
			const adActive = status === 'active' || status === 'trialing';
			const { error } = await supabase
				.from('user_profiles')
				.update({ subscription_status: status, ad_active: adActive })
				.eq('stripe_subscription_id', sub.id);
			if (error) console.error('Subscription update error:', error);
		}
	}

	// --- 支払い失敗 ---
	if (event.type === 'invoice.payment_failed') {
		const invoice = event.data.object;
		const subId = invoice.subscription;
		const supabaseUrl = env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
		const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
		if (subId && supabaseUrl && serviceKey) {
			const supabase = createClient(supabaseUrl, serviceKey);
			await supabase
				.from('user_profiles')
				.update({ subscription_status: 'past_due' })
				.eq('stripe_subscription_id', subId);
		}
	}

	return new Response('OK', { status: 200 });
}
