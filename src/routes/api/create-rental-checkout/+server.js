import { requireRentalUser } from '$lib/server/rental-authorization.js';
import { createPendingReservation, loadRentalTarget } from '$lib/server/rental-reservation.js';
import { rentalTotal } from '$lib/rental-payment.js';
import { rentalCharge, feesFromReservation } from '$lib/rental-pricing.js';
import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

export async function POST({ request }) {
	try {
		const body = await request.json();
		// 新規予約は body.reservation（予約内容）を受け取り、サーバー側で作成する。
		// body.reservationId は既存の未決済予約で決済をやり直す場合のみ使う。
		if (!body?.reservationId && !body?.reservation) throw error(400, '必須パラメータが不足しています');

		const stripeKey = env.STRIPE_SECRET_KEY;

		const supabaseUrl = env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
		const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
		if (!supabaseUrl || !serviceKey) throw error(500, 'Supabase設定が未設定です');

		const supabase = createClient(supabaseUrl, serviceKey);
		const user = await requireRentalUser(supabase, request);
		const userId = user.id;

		const { data: profile, error: profileError } = await supabase
			.from('user_profiles')
			.select('is_suspended')
			.eq('user_id', userId)
			.maybeSingle();
		if (profileError) throw error(500, 'アカウント情報を取得できませんでした');
		if (profile?.is_suspended) throw error(403, 'アカウントが停止されているため、予約できません。');

		const reservationId = body.reservationId
			? String(body.reservationId)
			: await createPendingReservation(supabase, userId, body.reservation);

		// 予約詳細を取得（料金計算のため）
		const { data: res, error: dbErr } = await supabase
			.from('reservations')
			.select('id, start_datetime, end_datetime, user_id, stall_id, rental_space_id, stripe_payment_intent_id')
			.eq('id', reservationId)
			.eq('status', 'pending')
			.single();

		if (dbErr?.code === '42703') throw error(503, '決済用データベースの設定が未完了です。運営へお問い合わせください。');
		if (dbErr) throw error(500, '予約情報を取得できませんでした');
		if (!res) throw error(404, '有効な予約が見つかりません');
		if (res.user_id !== userId) throw error(403, '権限がありません');
		if (res.stripe_payment_intent_id) throw error(409, 'この予約はすでに確定しています');

		// 料金はサーバー側の現在価格で確定する（0円の予約も当日のチェックインまで pending のまま）
		const { stall, space, fees } = await loadRentalTarget(supabase, {
			stallId: res.stall_id,
			rentalSpaceId: res.rental_space_id
		});
		const charge = rentalCharge({
			start: res.start_datetime,
			end: res.end_datetime,
			fees: feesFromReservation(fees)
		});
		const total = rentalTotal({ ...res, ...fees });
		const { error: feeError } = await supabase.from('reservations').update(fees)
			.eq('id', reservationId).eq('user_id', userId).eq('status', 'pending')
			.is('stripe_payment_intent_id', null);
		if (feeError) throw error(500, '予約料金を保存できませんでした');
		if (total === 0) return json({ free: true, reservationId });
		if (!stripeKey) throw error(500, '決済設定が未設定です');

		const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
		const place = [stall?.stall_name, space?.name].filter(Boolean).join('／');
		const lineItems = [];
		if (charge.base > 0) {
			lineItems.push({
				price_data: {
					currency: 'jpy',
					product_data: { name: `基本料金（3時間）${place ? `: ${place}` : ''}` },
					unit_amount: charge.base
				},
				quantity: 1
			});
		}
		if (charge.extension > 0) {
			lineItems.push({
				price_data: {
					currency: 'jpy',
					product_data: { name: `延長料金（30分 × ${charge.extensionSlots}）` },
					unit_amount: charge.extension
				},
				quantity: 1
			});
		}

		const session = await stripe.checkout.sessions.create({
			payment_method_types: ['card'],
			line_items: lineItems,
			mode: 'payment',
			// 与信枠の確保のみ（QRスキャン時に Capture して売上確定）
			payment_intent_data: { capture_method: 'manual' },
			success_url: `${new URL(request.url).origin}/map?rental_authorized=${reservationId}&session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${new URL(request.url).origin}/map?rental_cancelled=1`,
			expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
			metadata: { type: 'rental', reservationId, userId },
			locale: 'ja',
			// UI表示: 予約確定画面で与信確保である旨をメモとして表示
			custom_text: {
				submit: {
					message: 'カード情報を確認します。引き落としは現地QRスキャン時（チェックイン時）に行われます。'
				}
			}
		});

		return json({ url: session.url, sessionId: session.id, reservationId });

	} catch (err) {
		if (err?.status) throw err;
		console.error('[create-rental-checkout]', err);
		throw error(500, err?.message ?? String(err));
	}
}
