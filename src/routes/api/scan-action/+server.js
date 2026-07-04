import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

function haversineMeters(lat1, lng1, lat2, lng2) {
	const R = 6371000;
	const φ1 = (lat1 * Math.PI) / 180;
	const φ2 = (lat2 * Math.PI) / 180;
	const Δφ = ((lat2 - lat1) * Math.PI) / 180;
	const Δλ = ((lng2 - lng1) * Math.PI) / 180;
	const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const GPS_RADIUS_M = 50;

export async function POST({ request }) {
	const authHeader = request.headers.get('Authorization') ?? '';
	const token = authHeader.replace('Bearer ', '').trim();
	if (!token) throw error(401, 'Unauthorized');

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

	const {
		data: { user },
		error: authErr
	} = await supabase.auth.getUser(token);
	if (authErr || !user) throw error(401, 'Unauthorized');

	const body = await request.json().catch(() => ({}));
	const { type, id, lat, lng } = body;

	if (!type || !id) throw error(400, 'type と id は必須です');
	if (type !== 'space' && type !== 'yatai') throw error(400, 'type は space または yatai である必要があります');

	// 1. 対象の座標・名前を取得
	let targetLat = null;
	let targetLng = null;
	let placeName = '';

	if (type === 'space') {
		const { data: space, error: spaceErr } = await supabase
			.from('rental_spaces')
			.select('lat, lng, name')
			.eq('id', id)
			.single();
		if (spaceErr || !space) throw error(404, 'スペースが見つかりません');
		targetLat = space.lat;
		targetLng = space.lng;
		placeName = space.name;
	} else {
		const { data: stall, error: stallErr } = await supabase
			.from('stall_specs')
			.select('lat, lng, stall_name')
			.eq('id', id)
			.single();
		if (stallErr || !stall) throw error(404, '屋台情報が見つかりません');
		targetLat = stall.lat;
		targetLng = stall.lng;
		placeName = stall.stall_name;
	}

	// 2. GPS 検証（座標が設定されていてユーザーが位置情報を送った場合のみ）
	if (targetLat != null && targetLng != null && lat != null && lng != null) {
		const dist = Math.round(haversineMeters(lat, lng, targetLat, targetLng));
		if (dist > GPS_RADIUS_M) {
			throw error(403, `現地から離れすぎています（${dist}m）。${GPS_RADIUS_M}m 以内に近づいてからスキャンしてください。`);
		}
	}

	// 3. 該当する予約を検索（pending or active）
	const filterCol = type === 'space' ? 'rental_space_id' : 'stall_id';
	const { data: reservation, error: resErr } = await supabase
		.from('reservations')
		.select('id, status, stripe_payment_intent_id')
		.eq('user_id', user.id)
		.eq(filterCol, id)
		.in('status', ['pending', 'active'])
		.order('start_datetime', { ascending: true })
		.limit(1)
		.maybeSingle();

	if (resErr) throw error(500, resErr.message);
	if (!reservation) {
		throw error(404, 'この場所の有効な予約が見つかりません。予約状況をご確認ください。');
	}

	// 4. ステータスに応じてチェックインまたは返却
	if (reservation.status === 'pending') {
		// チェックイン: Stripe Capture → status = 'active'
		if (reservation.stripe_payment_intent_id) {
			const stripeKey = env.STRIPE_SECRET_KEY;
			if (!stripeKey) throw error(500, 'STRIPE_SECRET_KEY が未設定です');
			const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
			try {
				const pi = await stripe.paymentIntents.capture(reservation.stripe_payment_intent_id);
				if (pi.status !== 'succeeded') {
					throw error(402, `決済の確定に失敗しました（Stripe status: ${pi.status}）`);
				}
			} catch (stripeErr) {
				if (stripeErr?.status) throw stripeErr;
				console.error('[scan-action] Stripe capture failed:', stripeErr);
				throw error(402, '決済の処理に失敗しました。カード情報をご確認ください。');
			}
		}

		const { error: updateErr } = await supabase
			.from('reservations')
			.update({ status: 'active' })
			.eq('id', reservation.id)
			.eq('status', 'pending');

		if (updateErr) throw error(500, 'チェックイン処理に失敗しました: ' + updateErr.message);

		return json({ action: 'checkin', name: placeName });
	} else {
		// 返却: status = 'completed'
		const { error: updateErr } = await supabase
			.from('reservations')
			.update({ status: 'completed' })
			.eq('id', reservation.id)
			.eq('status', 'active');

		if (updateErr) throw error(500, '返却処理に失敗しました: ' + updateErr.message);

		// 営業を1回完了 → 信用スコア +5（二重付与防止）
		let creditBonus = 0;
		const { data: flagged } = await supabase
			.from('reservations')
			.update({ return_credit_awarded: true })
			.eq('id', reservation.id)
			.eq('return_credit_awarded', false)
			.select('id');
		if (flagged?.length) {
			const { data: prof } = await supabase
				.from('user_profiles')
				.select('credit_score')
				.eq('user_id', user.id)
				.single();
			const newScore = (prof?.credit_score ?? 100) + 5;
			await supabase.from('user_profiles').update({ credit_score: newScore }).eq('user_id', user.id);
			creditBonus = 5;
		}

		return json({ action: 'return', name: placeName, creditBonus });
	}
}
