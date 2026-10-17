import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import {
	requireRentalUser,
	confirmRentalAuthorization,
	confirmRentalHold
} from '$lib/server/rental-authorization.js';

export const prerender = false;

/**
 * Stripe Checkout から戻ってきたときの確認（Webhook と同じ処理。どちらが先でもよい）
 * - type=rental      … 予約時のカード登録（新方式）／予約時の与信（旧方式）
 * - type=rental_hold … チェックイン時にカードを確認し直した仮押さえ
 */
export async function POST({ request }) {
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const user = await requireRentalUser(supabase, request);
	const { sessionId, reservationId } = await request.json();
	if (!sessionId || !reservationId) error(400, '必須パラメータが不足しています');
	if (!env.STRIPE_SECRET_KEY) error(500, '決済設定が未設定です');
	const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
	const session = await stripe.checkout.sessions.retrieve(sessionId, {
		expand: ['payment_intent', 'setup_intent']
	});
	const args = { stripe, supabase, session, reservationId, userId: user.id };
	if (session.metadata?.type === 'rental_hold') {
		await confirmRentalHold(args);
		return json({ authorized: true, kind: 'hold' });
	}
	await confirmRentalAuthorization(args);
	return json({ authorized: true, kind: session.mode === 'setup' ? 'card' : 'legacy' });
}
