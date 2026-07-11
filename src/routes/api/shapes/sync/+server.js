import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

const VALID = ['star', 'heart', 'diamond', 'hexagon'];

// 決済復帰時に Checkout セッションを直接確認して owned_shapes に反映（webhook遅延・未達の保険）
export async function POST({ request }) {
	const authHeader = request.headers.get('Authorization') ?? '';
	const token = authHeader.replace('Bearer ', '').trim();
	if (!token) throw error(401, 'ログインが必要です');

	const stripeKey = env.STRIPE_SECRET_KEY;
	if (!stripeKey) throw error(500, 'STRIPE_SECRET_KEY が未設定です');

	const { sessionId } = await request.json().catch(() => ({}));
	if (!sessionId) throw error(400, 'セッションIDがありません');

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
	if (authErr || !user) throw error(401, 'ログインが必要です');

	const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
	const session = await stripe.checkout.sessions.retrieve(sessionId);

	// 本人 & 支払い済みのセッションのみ反映
	if (session.client_reference_id && session.client_reference_id !== user.id) {
		throw error(403, 'セッションが一致しません');
	}
	if (session.payment_status !== 'paid') {
		return json({ granted: false, pending: true });
	}
	const shape = session.metadata?.shape;
	if (!VALID.includes(shape)) throw error(400, '不正な形状です');

	const { data } = await supabase
		.from('user_profiles')
		.select('owned_shapes')
		.eq('user_id', user.id)
		.maybeSingle();
	const owned = Array.isArray(data?.owned_shapes) ? data.owned_shapes : [];
	if (!owned.includes(shape)) {
		const { error: upErr } = await supabase
			.from('user_profiles')
			.update({ owned_shapes: [...owned, shape] })
			.eq('user_id', user.id);
		if (upErr) console.error('shape sync update error:', upErr);
	}

	return json({ granted: true, shape });
}
