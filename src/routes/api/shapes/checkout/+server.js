import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

// アイコン形状（買い切り ¥500）の一覧。価格は必ずサーバー側で決定する。
const SHAPES = {
	star:    { label: '星',     price: 500 },
	heart:   { label: 'ハート', price: 500 },
	diamond: { label: '菱形',   price: 500 },
	hexagon: { label: '六角形', price: 500 }
};

// アイコン形状の買い切り決済セッションを作成
export async function POST({ request }) {
	const authHeader = request.headers.get('Authorization') ?? '';
	const token = authHeader.replace('Bearer ', '').trim();
	if (!token) throw error(401, 'ログインが必要です');

	const stripeKey = env.STRIPE_SECRET_KEY;
	if (!stripeKey) throw error(500, 'STRIPE_SECRET_KEY が未設定です');

	const { shape } = await request.json().catch(() => ({}));
	const def = SHAPES[shape];
	if (!def) throw error(400, '不正な形状です');

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
	if (authErr || !user) throw error(401, 'ログインが必要です');

	// 既に所有していれば決済不要
	const { data: profile } = await supabase
		.from('user_profiles')
		.select('owned_shapes')
		.eq('user_id', user.id)
		.maybeSingle();
	if (Array.isArray(profile?.owned_shapes) && profile.owned_shapes.includes(shape)) {
		throw error(400, 'すでに購入済みの形状です');
	}

	const origin = new URL(request.url).origin;
	const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
	const session = await stripe.checkout.sessions.create({
		mode: 'payment',
		payment_method_types: ['card'],
		line_items: [{
			price_data: {
				currency: 'jpy',
				product_data: { name: `アイコン形状「${def.label}」` },
				unit_amount: def.price
			},
			quantity: 1
		}],
		client_reference_id: user.id,
		customer_email: user.email ?? undefined,
		metadata: { type: 'icon_shape', userId: user.id, shape },
		locale: 'ja',
		success_url: `${origin}/mypage?shape=bought&sid={CHECKOUT_SESSION_ID}`,
		cancel_url: `${origin}/mypage`
	});

	return json({ url: session.url });
}
