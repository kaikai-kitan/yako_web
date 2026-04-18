import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';

export const prerender = false;

export async function POST({ request }) {
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

	const stripe = new Stripe(env.STRIPE_SECRET_KEY);

	const lineItems = items.map((item) => ({
		price_data: {
			currency: 'jpy',
			product_data: {
				name: item.name,
				...(item.photoUrl ? { images: [item.photoUrl] } : {})
			},
			unit_amount: item.price
		},
		quantity: item.quantity
	}));

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
}
