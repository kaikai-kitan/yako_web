import { error } from '@sveltejs/kit';
import { rentalTotal, RENTAL_PAYMENT_FIELDS } from '$lib/rental-payment.js';
import { toJstIso } from '$lib/rental-pricing.js';
import { busyIntervals } from '$lib/rental-availability.js';
import { releaseHold } from '$lib/server/rental-billing.js';

export async function requireRentalUser(supabase, request) {
	const token = request.headers
		.get('Authorization')
		?.replace(/^Bearer\s+/i, '')
		.trim();
	if (!token) error(401, 'ログインが必要です');
	const { data, error: authError } = await supabase.auth.getUser(token);
	if (authError || !data?.user) error(401, 'ログインが必要です');
	return data.user;
}

async function loadOwnReservation(supabase, reservationId, userId) {
	const { data: reservation, error: readError } = await supabase
		.from('reservations')
		.select(`id, user_id, stall_id, status, start_datetime, end_datetime, stripe_customer_id, stripe_hold_intent_id, ${RENTAL_PAYMENT_FIELDS}`)
		.eq('id', reservationId)
		.eq('user_id', userId)
		.single();
	if (readError) error(500, '予約情報を確認できませんでした');
	if (!reservation) error(404, '予約が見つかりません');
	if (!['pending', 'active', 'completed'].includes(reservation.status)) error(409, 'この予約は確定できません');
	return reservation;
}

/** カード入力中に、同じ屋台の重なる時間帯で別の予約が確定していないか */
async function assertSlotStillFree(supabase, reservation) {
	if (reservation.status !== 'pending' || !reservation.stall_id) return;
	const { data: others, error: availabilityError } = await supabase
		.from('reservations')
		.select(`id, status, start_datetime, end_datetime, ${RENTAL_PAYMENT_FIELDS}`)
		.eq('stall_id', reservation.stall_id)
		.neq('id', reservation.id)
		.in('status', ['pending', 'active']);
	if (availabilityError) error(500, '屋台の空き状況を確認できませんでした');
	const start = Date.parse(toJstIso(reservation.start_datetime));
	const end = Date.parse(toJstIso(reservation.end_datetime));
	const clash = busyIntervals(others ?? []).some((i) => start < i.end && end > i.start);
	if (clash) error(409, 'この時間帯は別の予約が確定しました。別の時間をお選びください。');
}

// Shared by the signed webhook and the authenticated return from Checkout.
export async function confirmRentalAuthorization({ stripe, supabase, session, reservationId, userId }) {
	if (
		!['payment', 'setup'].includes(session.mode) ||
		session.metadata?.type !== 'rental' ||
		session.metadata.reservationId !== reservationId ||
		session.metadata.userId !== userId
	) {
		error(400, '予約情報が一致しません');
	}
	if (session.mode === 'setup') return confirmCardRegistration({ stripe, supabase, session, reservationId, userId });

	// ---- 旧方式（予約時に与信）: デプロイ前に開始された決済のために残す ----
	if (session.status !== 'complete' || !session.payment_intent)
		error(402, 'カードの確認が完了していません');
	const paymentIntent =
		typeof session.payment_intent === 'string'
			? await stripe.paymentIntents.retrieve(session.payment_intent)
			: session.payment_intent;
	if (!['requires_capture', 'succeeded'].includes(paymentIntent.status)) {
		error(402, 'カードの与信確保が完了していません');
	}
	const reservation = await loadOwnReservation(supabase, reservationId, userId);
	if (paymentIntent.currency !== 'jpy' || paymentIntent.amount !== rentalTotal(reservation)) {
		error(400, '予約の料金と支払い情報が一致しません');
	}
	if (reservation.stripe_payment_intent_id === paymentIntent.id) return paymentIntent.id;
	if (reservation.stripe_payment_intent_id) error(409, '別の支払いで確定済みです');
	try {
		await assertSlotStillFree(supabase, reservation);
	} catch (e) {
		if (paymentIntent.status === 'requires_capture') await stripe.paymentIntents.cancel(paymentIntent.id);
		throw e;
	}
	const { data: updated, error: updateError } = await supabase
		.from('reservations')
		.update({ stripe_payment_intent_id: paymentIntent.id })
		.eq('id', reservationId)
		.eq('user_id', userId)
		.eq('status', reservation.status)
		.is('stripe_payment_intent_id', null)
		.select('id');
	if (updateError) error(500, '予約の確定に失敗しました');
	if (!updated?.length) {
		// A webhook and the return URL can confirm the same session concurrently.
		const { data: latest, error: latestError } = await supabase
			.from('reservations')
			.select('status, stripe_payment_intent_id')
			.eq('id', reservationId)
			.single();
		if (latestError) error(500, '予約の確定を確認できませんでした');
		if (
			latest?.stripe_payment_intent_id !== paymentIntent.id ||
			!['pending', 'active', 'completed'].includes(latest.status)
		)
			error(409, '予約の状態が変更されました');
	}
	return paymentIntent.id;
}

/** 新方式: 予約時のカード登録（setup モード）を確認し、カードを予約に保存して確定する */
async function confirmCardRegistration({ stripe, supabase, session, reservationId, userId }) {
	if (session.status !== 'complete' || !session.setup_intent) error(402, 'カードの登録が完了していません');
	const setupIntent =
		typeof session.setup_intent === 'string'
			? await stripe.setupIntents.retrieve(session.setup_intent)
			: session.setup_intent;
	if (setupIntent.status !== 'succeeded' || !setupIntent.payment_method) error(402, 'カードの登録が完了していません');
	const paymentMethodId =
		typeof setupIntent.payment_method === 'string' ? setupIntent.payment_method : setupIntent.payment_method.id;
	const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
	if (!customerId) error(400, '顧客情報が見つかりません');

	const reservation = await loadOwnReservation(supabase, reservationId, userId);
	if (reservation.stripe_payment_method_id === paymentMethodId) return paymentMethodId;
	if (reservation.stripe_payment_method_id) error(409, '別のカードで確定済みです');
	await assertSlotStillFree(supabase, reservation);

	const { data: updated, error: updateError } = await supabase
		.from('reservations')
		.update({ stripe_payment_method_id: paymentMethodId, stripe_customer_id: customerId })
		.eq('id', reservationId)
		.eq('user_id', userId)
		.eq('status', reservation.status)
		.is('stripe_payment_method_id', null)
		.select('id');
	if (updateError) error(500, '予約の確定に失敗しました');
	if (!updated?.length) {
		const { data: latest } = await supabase
			.from('reservations')
			.select('status, stripe_payment_method_id')
			.eq('id', reservationId)
			.single();
		if (latest?.stripe_payment_method_id !== paymentMethodId) error(409, '予約の状態が変更されました');
	}
	return paymentMethodId;
}

/**
 * チェックイン時にカードが通らなかった場合の確認し直し（Checkout の payment モード・仮押さえ）。
 * 成功したら与信とカードを予約に保存する。チェックインはもう一度QRをスキャンして行う。
 */
export async function confirmRentalHold({ stripe, supabase, session, reservationId, userId }) {
	if (
		session.mode !== 'payment' ||
		session.metadata?.type !== 'rental_hold' ||
		session.metadata.reservationId !== reservationId ||
		session.metadata.userId !== userId
	) {
		error(400, '予約情報が一致しません');
	}
	if (session.status !== 'complete' || !session.payment_intent) error(402, 'カードの確認が完了していません');
	const pi =
		typeof session.payment_intent === 'string'
			? await stripe.paymentIntents.retrieve(session.payment_intent)
			: session.payment_intent;
	if (pi.status !== 'requires_capture') error(402, 'カードの仮押さえが完了していません');
	const reservation = await loadOwnReservation(supabase, reservationId, userId);
	if (reservation.stripe_hold_intent_id === pi.id) return pi.id;
	const paymentMethodId = typeof pi.payment_method === 'string' ? pi.payment_method : pi.payment_method?.id;
	const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
	const { error: updateError } = await supabase
		.from('reservations')
		.update({
			stripe_hold_intent_id: pi.id,
			...(paymentMethodId ? { stripe_payment_method_id: paymentMethodId } : {}),
			...(customerId ? { stripe_customer_id: customerId } : {})
		})
		.eq('id', reservationId)
		.eq('user_id', userId)
		.eq('status', 'pending');
	if (updateError) error(500, 'カードの確認結果を保存できませんでした');
	// 以前の仮押さえが残っていれば解放する
	if (reservation.stripe_hold_intent_id && reservation.stripe_hold_intent_id !== pi.id) {
		await releaseHold(stripe, reservation.stripe_hold_intent_id);
	}
	return pi.id;
}
