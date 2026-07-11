import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

// 決済完了直後に Stripe と直接同期して subscription_status / ad_active を確定させる。
// webhook の遅延・未達に依存せず、mypage 復帰時に呼ぶことで「申し込みボタンが出続ける」問題を防ぐ。
export async function POST({ request }) {
	const authHeader = request.headers.get('Authorization') ?? '';
	const token = authHeader.replace('Bearer ', '').trim();
	if (!token) throw error(401, 'ログインが必要です');

	const stripeKey = env.STRIPE_SECRET_KEY;
	if (!stripeKey) throw error(500, 'STRIPE_SECRET_KEY が未設定です');

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
	if (authErr || !user) throw error(401, 'ログインが必要です');

	const { sessionId } = await request.json().catch(() => ({}));

	const { data: profile } = await supabase
		.from('user_profiles')
		.select('stripe_customer_id, stripe_subscription_id')
		.eq('user_id', user.id)
		.maybeSingle();

	const stripe = new Stripe(stripeKey);

	let customerId = profile?.stripe_customer_id ?? null;
	let subscription = null;

	// 1) Checkout セッションIDがあれば、それを起点に顧客・サブスクを特定（最も確実）
	if (sessionId) {
		try {
			const session = await stripe.checkout.sessions.retrieve(sessionId, {
				expand: ['subscription']
			});
			// 他人のセッションを反映させないための本人確認
			if (session.client_reference_id && session.client_reference_id !== user.id) {
				throw error(403, 'セッションが一致しません');
			}
			customerId = (typeof session.customer === 'string' ? session.customer : session.customer?.id) ?? customerId;
			if (session.subscription && typeof session.subscription === 'object') {
				subscription = session.subscription;
			}
		} catch (e) {
			if (e?.status === 403) throw e;
			// セッション取得に失敗しても、顧客IDからのフォールバックを試みる
		}
	}

	// 2) サブスクが未取得なら、顧客IDから最新のサブスクを引く
	if (!subscription && customerId) {
		const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 3 });
		// active/trialing を優先、なければ最新
		subscription = subs.data.find((s) => s.status === 'active' || s.status === 'trialing') ?? subs.data[0] ?? null;
	}

	if (!subscription) {
		// まだ Stripe 側に反映されていない（ごく短時間の遅延）場合。現状のまま返す。
		return json({ subscription_status: 'none', ad_active: false, pending: true });
	}

	const status = subscription.status; // active | trialing | past_due | canceled ...
	const adActive = status === 'active' || status === 'trialing';

	const { error: upErr } = await supabase
		.from('user_profiles')
		.update({
			stripe_customer_id: customerId,
			stripe_subscription_id: subscription.id,
			subscription_status: status,
			ad_active: adActive
		})
		.eq('user_id', user.id);
	if (upErr) console.error('subscription sync update error:', upErr);

	return json({ subscription_status: status, ad_active: adActive });
}
