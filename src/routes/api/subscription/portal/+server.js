import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

// Stripe カスタマーポータル（プラン変更・解約・支払い方法の管理）
export async function POST({ request }) {
	const authHeader = request.headers.get('Authorization') ?? '';
	const token = authHeader.replace('Bearer ', '').trim();
	if (!token) throw error(401, 'ログインが必要です');

	const stripeKey = env.STRIPE_SECRET_KEY;
	if (!stripeKey) throw error(500, 'STRIPE_SECRET_KEY が未設定です');

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
	if (authErr || !user) throw error(401, 'ログインが必要です');

	const { data: profile } = await supabase
		.from('user_profiles')
		.select('stripe_customer_id')
		.eq('user_id', user.id)
		.maybeSingle();
	if (!profile?.stripe_customer_id) throw error(400, 'お支払い情報が見つかりません');

	const origin = new URL(request.url).origin;
	const stripe = new Stripe(stripeKey);
	const portal = await stripe.billingPortal.sessions.create({
		customer: profile.stripe_customer_id,
		return_url: `${origin}/mypage`
	});

	return json({ url: portal.url });
}
