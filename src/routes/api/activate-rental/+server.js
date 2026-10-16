import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { requireRentalUser, confirmRentalAuthorization } from '$lib/server/rental-authorization.js';

export const prerender = false;

export async function POST({ request }) {
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const user = await requireRentalUser(supabase, request);
	const { sessionId, reservationId } = await request.json();
	if (!sessionId || !reservationId) error(400, '必須パラメータが不足しています');
	if (!env.STRIPE_SECRET_KEY) error(500, '決済設定が未設定です');
	const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
	const session = await stripe.checkout.sessions.retrieve(sessionId, {
		expand: ['payment_intent']
	});
	const paymentIntentId = await confirmRentalAuthorization({
		stripe,
		supabase,
		session,
		reservationId,
		userId: user.id
	});
	return json({ authorized: true, paymentIntentId });
}
