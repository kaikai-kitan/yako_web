// 屋台レンタルの請求処理（サーバー専用）
//
// 新しい流れ:
//   予約時      … Stripe Checkout（setup モード）でカードを登録するだけ（請求なし）
//   チェックイン … 登録カードで予約時間分の与信（capture_method: manual）を確保
//   返却時      … 延長・超過を含めた合計を1回で請求し、与信は解放
//                  請求できない場合は与信分だけ確定（charge_status = partial）
//   無断キャンセル … 登録カードに基本料金（屋台＋場所の3時間分）を請求
// 旧方式（予約時に与信: stripe_payment_intent_id）の予約にも対応する。
import { error } from '@sveltejs/kit';
import { rentalCharge, feesFromReservation, noShowCharge } from '$lib/rental-pricing.js';

/** 与信（仮押さえ）を解放する。失敗してもログだけ残して続行する */
export async function releaseHold(stripe, intentId, label = '') {
	try {
		await stripe.paymentIntents.cancel(intentId);
	} catch (e) {
		console.error('[rental-billing] release hold failed:', label || intentId, e?.message);
	}
}

/** 予約者の Stripe 顧客を取得（無ければ作成して user_profiles に保存） */
export async function getOrCreateCustomer({ stripe, supabase, user }) {
	const { data: profile } = await supabase
		.from('user_profiles')
		.select('stripe_customer_id, name')
		.eq('user_id', user.id)
		.maybeSingle();
	if (profile?.stripe_customer_id) return profile.stripe_customer_id;
	const customer = await stripe.customers.create(
		{ email: user.email ?? undefined, name: profile?.name ?? undefined, metadata: { userId: user.id } },
		{ idempotencyKey: `customer-${user.id}` }
	);
	await supabase.from('user_profiles').update({ stripe_customer_id: customer.id }).eq('user_id', user.id);
	return customer.id;
}

/** 予約時間分の金額（与信額） */
export function reservedAmount(reservation) {
	return rentalCharge({
		start: reservation.start_datetime,
		end: reservation.end_datetime,
		fees: feesFromReservation(reservation)
	}).total;
}

/**
 * チェックイン時の与信。
 * - 新方式: 登録カードで予約時間分を確保（すでに確保済みなら何もしない）
 * - 旧方式: 予約時に確保した与信を確定（従来どおり）
 * 失敗したら 402（code: card_check_required）。予約は pending のまま。
 */
export async function secureRentalAtCheckIn({ stripe, supabase, reservation }) {
	const amount = reservedAmount(reservation);

	if (!reservation.stripe_payment_method_id && reservation.stripe_payment_intent_id) {
		// 旧方式: 予約時の与信を確定
		const pi = await stripe.paymentIntents.capture(reservation.stripe_payment_intent_id);
		if (pi.status !== 'succeeded') error(402, '決済の確定に失敗しました。カード情報をご確認ください。');
		return { mode: 'legacy' };
	}
	if (amount === 0) return { mode: 'free' };
	if (reservation.stripe_hold_intent_id) return { mode: 'hold', intentId: reservation.stripe_hold_intent_id };
	if (!reservation.stripe_payment_method_id || !reservation.stripe_customer_id) {
		error(402, { message: 'カードの確認が必要です。', code: 'card_check_required' });
	}

	let pi;
	try {
		pi = await stripe.paymentIntents.create(
			{
				amount,
				currency: 'jpy',
				customer: reservation.stripe_customer_id,
				payment_method: reservation.stripe_payment_method_id,
				capture_method: 'manual',
				off_session: true,
				confirm: true,
				description: '屋台レンタル（予約時間分の仮押さえ）',
				metadata: { type: 'rental_hold', reservationId: reservation.id }
			},
			{ idempotencyKey: `rental-hold-${reservation.id}-${amount}` }
		);
	} catch (e) {
		console.error('[rental-billing] hold failed:', reservation.id, e?.code ?? e?.message);
		error(402, {
			message: 'カードの仮押さえができませんでした。カードを確認し直してから、もう一度QRをスキャンしてください。',
			code: 'card_check_required'
		});
	}
	if (pi.status !== 'requires_capture') {
		error(402, { message: 'カードの確認が必要です。', code: 'card_check_required' });
	}
	const { error: saveError } = await supabase
		.from('reservations')
		.update({ stripe_hold_intent_id: pi.id })
		.eq('id', reservation.id)
		.is('stripe_hold_intent_id', null);
	if (saveError) {
		await releaseHold(stripe, pi.id);
		error(500, 'チェックイン処理に失敗しました');
	}
	return { mode: 'hold', intentId: pi.id };
}

/**
 * 返却時の一括請求。charge は rentalCharge() の結果（予約終了と実際の返却の遅い方まで）。
 * @returns {{ charged:number, chargeStatus:'paid'|'partial'|'failed', chargeIntentId:string|null }}
 */
export async function chargeOnReturn({ stripe, reservation, total }) {
	if (total === 0) {
		if (reservation.stripe_hold_intent_id) await releaseHold(stripe, reservation.stripe_hold_intent_id);
		return { charged: 0, chargeStatus: 'paid', chargeIntentId: null };
	}

	// 旧方式: チェックイン時に予約時間分を確定済み。超過分は回収できない
	if (!reservation.stripe_payment_method_id && reservation.stripe_payment_intent_id) {
		const already = reservedAmount(reservation);
		return {
			charged: Math.min(already, total),
			chargeStatus: total > already ? 'partial' : 'paid',
			chargeIntentId: reservation.stripe_payment_intent_id
		};
	}

	if (reservation.stripe_payment_method_id && reservation.stripe_customer_id) {
		try {
			const pi = await stripe.paymentIntents.create(
				{
					amount: total,
					currency: 'jpy',
					customer: reservation.stripe_customer_id,
					payment_method: reservation.stripe_payment_method_id,
					off_session: true,
					confirm: true,
					description: '屋台レンタル（返却時の精算）',
					metadata: { type: 'rental_final', reservationId: reservation.id }
				},
				{ idempotencyKey: `rental-final-${reservation.id}-${total}` }
			);
			if (pi.status === 'succeeded') {
				if (reservation.stripe_hold_intent_id) {
					await releaseHold(stripe, reservation.stripe_hold_intent_id, reservation.id);
				}
				return { charged: total, chargeStatus: 'paid', chargeIntentId: pi.id };
			}
		} catch (e) {
			console.error('[rental-billing] final charge failed:', reservation.id, e?.code ?? e?.message);
		}
	}

	// 一括請求できなかった場合は、仮押さえ分だけ確定する
	if (reservation.stripe_hold_intent_id) {
		try {
			const hold = await stripe.paymentIntents.retrieve(reservation.stripe_hold_intent_id);
			if (hold.status === 'requires_capture') {
				const captured = await stripe.paymentIntents.capture(hold.id, {
					amount_to_capture: Math.min(total, hold.amount)
				});
				const amount = captured.amount_received ?? Math.min(total, hold.amount);
				return { charged: amount, chargeStatus: amount >= total ? 'paid' : 'partial', chargeIntentId: hold.id };
			}
		} catch (e) {
			console.error('[rental-billing] capture hold failed:', reservation.id, e?.message);
		}
	}
	return { charged: 0, chargeStatus: 'failed', chargeIntentId: null };
}

/** 無断キャンセル時の請求（基本料金＝屋台＋場所の3時間分） */
export async function chargeNoShow({ stripe, reservation }) {
	const amount = noShowCharge(feesFromReservation(reservation));
	if (amount === 0) return { charged: 0, chargeStatus: 'paid', chargeIntentId: null };

	// 旧方式: 予約時の与信のうち基本料金分だけを確定し、残りは解放
	if (!reservation.stripe_payment_method_id && reservation.stripe_payment_intent_id) {
		const intent = await stripe.paymentIntents.retrieve(reservation.stripe_payment_intent_id);
		if (intent.status !== 'requires_capture') return { charged: 0, chargeStatus: 'failed', chargeIntentId: intent.id };
		const pi = await stripe.paymentIntents.capture(intent.id, { amount_to_capture: Math.min(amount, intent.amount) });
		return {
			charged: pi.amount_received ?? Math.min(amount, intent.amount),
			chargeStatus: pi.status === 'succeeded' ? 'paid' : 'failed',
			chargeIntentId: intent.id
		};
	}
	if (!reservation.stripe_payment_method_id || !reservation.stripe_customer_id) {
		return { charged: 0, chargeStatus: 'failed', chargeIntentId: null };
	}
	try {
		const pi = await stripe.paymentIntents.create(
			{
				amount,
				currency: 'jpy',
				customer: reservation.stripe_customer_id,
				payment_method: reservation.stripe_payment_method_id,
				off_session: true,
				confirm: true,
				description: '屋台レンタル（無断キャンセル：基本料金）',
				metadata: { type: 'rental_noshow', reservationId: reservation.id }
			},
			{ idempotencyKey: `rental-noshow-${reservation.id}` }
		);
		return { charged: pi.status === 'succeeded' ? amount : 0, chargeStatus: pi.status === 'succeeded' ? 'paid' : 'failed', chargeIntentId: pi.id };
	} catch (e) {
		console.error('[rental-billing] no-show charge failed:', reservation.id, e?.code ?? e?.message);
		return { charged: 0, chargeStatus: 'failed', chargeIntentId: null };
	}
}

/** 請求に必要な予約の列 */
export const BILLING_FIELDS =
	'id, user_id, status, start_datetime, end_datetime, stall_id, rental_space_id, ' +
	'stripe_payment_intent_id, stripe_payment_method_id, stripe_customer_id, stripe_hold_intent_id, ' +
	'locked_space_fee, locked_stall_fee, locked_space_ext_fee, locked_stall_ext_fee';

/**
 * 返却の確定（アプリ内の返却とQRでの返却で共通）。
 * active → completed の切り替えに成功した1回だけ、請求・売上・支払い履歴を記録する。
 */
export async function finalizeRentalReturn({ stripe, supabase, reservationId, userId, salesItems = {}, now = Date.now() }) {
	const { data: res, error: resError } = await supabase
		.from('reservations')
		.select(`${BILLING_FIELDS},
			stall_specs ( user_id, operators ( business_name ) ),
			rental_spaces ( user_id, owners ( owner_name ) )`)
		.eq('id', reservationId)
		.maybeSingle();
	if (resError) error(500, '予約情報を取得できませんでした');
	if (!res) error(404, '予約が見つかりません');
	if (res.user_id !== userId) error(403, '権限がありません');
	if (res.status === 'completed') return { completed: true, already: true };
	if (res.status !== 'active') error(409, '利用中の予約ではないため返却できません');

	const returnedAt = new Date(now).toISOString();
	const { data: switched, error: updateError } = await supabase
		.from('reservations')
		.update({ status: 'completed', returned_at: returnedAt })
		.eq('id', reservationId)
		.eq('user_id', userId)
		.eq('status', 'active')
		.select('id');
	if (updateError) error(500, '返却処理に失敗しました');
	if (!switched?.length) return { completed: true, already: true };

	if (Object.values(salesItems).some((n) => n > 0)) {
		const { error: salesError } = await supabase
			.from('sales')
			.insert({ reservation_id: reservationId, item_sales: salesItems });
		if (salesError) console.error('[rental-billing] sales insert failed:', salesError.code);
	}

	const charge = rentalCharge({
		start: res.start_datetime,
		end: res.end_datetime,
		returnedAt: now,
		fees: feesFromReservation(res)
	});
	const billing = stripe
		? await chargeOnReturn({ stripe, reservation: res, total: charge.total })
		: { charged: 0, chargeStatus: charge.total === 0 ? 'paid' : 'failed', chargeIntentId: null };

	await supabase
		.from('reservations')
		.update({
			charged_amount: billing.charged,
			charge_status: billing.chargeStatus,
			stripe_charge_intent_id: billing.chargeIntentId
		})
		.eq('id', reservationId);

	// 支払い履歴（屋台提供者・場所提供者それぞれ）。月末の振込計算に使う
	const payments = [];
	if (res.stall_specs?.user_id && charge.stall > 0) {
		payments.push({
			reservation_id: reservationId,
			payer_id: userId,
			recipient_id: res.stall_specs.user_id,
			recipient_name: res.stall_specs.operators?.business_name ?? null,
			total_amount: charge.stall,
			payee_role: 'stall'
		});
	}
	if (res.rental_spaces?.user_id && charge.space > 0) {
		payments.push({
			reservation_id: reservationId,
			payer_id: userId,
			recipient_id: res.rental_spaces.user_id,
			recipient_name: res.rental_spaces.owners?.owner_name ?? null,
			total_amount: charge.space,
			payee_role: 'space'
		});
	}
	if (payments.length > 0) {
		const { error: paymentError } = await supabase.from('payment_history').insert(payments);
		if (paymentError) console.error('[rental-billing] payment_history insert failed:', paymentError.code);
	}

	return {
		completed: true,
		charge: { total: charge.total, base: charge.base, extension: charge.extension, extensionSlots: charge.extensionSlots, minutes: charge.minutes },
		charged: billing.charged,
		chargeStatus: billing.chargeStatus
	};
}
