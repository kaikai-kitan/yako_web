import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';

export const prerender = false;

export async function POST({ request }) {
	try {
		let body;
		try {
			body = await request.json();
		} catch {
			throw error(400, 'Invalid JSON');
		}

		const { items, successUrl, cancelUrl, userId } = body;

		if (!items || items.length === 0) {
			throw error(400, 'カートが空です');
		}

		const key = env.STRIPE_SECRET_KEY;
		if (!key) {
			throw error(500, 'STRIPE_SECRET_KEY が Vercel 環境変数に未設定です');
		}

		const stripe = new Stripe(key, { apiVersion: '2024-06-20' });

		const lineItems = items.map((item) => {
			const productData = { name: item.name };
			// Stripe は絶対URL のみ受け付けるため、https:// で始まる場合のみ画像を渡す
			if (item.photoUrl && item.photoUrl.startsWith('https://')) {
				productData.images = [item.photoUrl];
			}
			return {
				price_data: {
					currency: 'jpy',
					product_data: productData,
					unit_amount: item.price
				},
				quantity: item.quantity
			};
		});

		const session = await stripe.checkout.sessions.create({
			payment_method_types: ['card'],
			line_items: lineItems,
			mode: 'payment',
			success_url: successUrl,
			cancel_url: cancelUrl,
			metadata: { userId: userId ?? '' },
			locale: 'ja'
		});

		return json({ url: session.url, sessionId: session.id });

	} catch (err) {
		// SvelteKit の HttpError はそのまま再スロー
		if (err?.status) throw err;
		// 予期しないエラーは詳細をレスポンスに含める
		console.error('[create-checkout] Unexpected error:', err);
		throw error(500, err?.message ?? String(err));
	}
}
