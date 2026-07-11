import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

// 法人プラン（月額サブスク）の Stripe Checkout セッションを作成
export async function POST({ request }) {
	const authHeader = request.headers.get('Authorization') ?? '';
	const token = authHeader.replace('Bearer ', '').trim();
	if (!token) throw error(401, 'ログインが必要です');

	const stripeKey = env.STRIPE_SECRET_KEY;
	const priceId = env.STRIPE_CORPORATE_PRICE_ID;
	if (!stripeKey) throw error(500, 'STRIPE_SECRET_KEY が未設定です');
	if (!priceId) throw error(500, 'STRIPE_CORPORATE_PRICE_ID が未設定です（Stripeで法人プランの価格を作成してください）');

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
	if (authErr || !user) throw error(401, 'ログインが必要です');

	// 承認済みの法人アカウントのみ申し込み可
	const { data: profile } = await supabase
		.from('user_profiles')
		.select('account_type, corp_status, stripe_customer_id, subscription_status')
		.eq('user_id', user.id)
		.maybeSingle();

	if (!profile || profile.account_type !== 'corporate' || profile.corp_status !== 'approved') {
		throw error(403, '法人アカウントの承認後にお申し込みいただけます');
	}
	if (profile.subscription_status === 'active') {
		throw error(400, 'すでに法人プランをご利用中です');
	}

	const { successUrl, cancelUrl } = await request.json().catch(() => ({}));
	const origin = new URL(request.url).origin;

	const stripe = new Stripe(stripeKey);
	const session = await stripe.checkout.sessions.create({
		mode: 'subscription',
		line_items: [{ price: priceId, quantity: 1 }],
		customer: profile.stripe_customer_id || undefined,
		customer_email: profile.stripe_customer_id ? undefined : (user.email ?? undefined),
		client_reference_id: user.id,
		metadata: { type: 'corporate_subscription', userId: user.id },
		subscription_data: { metadata: { type: 'corporate_subscription', userId: user.id } },
		success_url: successUrl || `${origin}/mypage?corp=subscribed&sid={CHECKOUT_SESSION_ID}`,
		cancel_url: cancelUrl || `${origin}/mypage`
	});

	return json({ url: session.url });
}
