import { error } from '@sveltejs/kit';
import { isRentalConfirmed, rentalTotal, RENTAL_PAYMENT_FIELDS } from '$lib/rental-payment.js';

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

// Shared by the signed webhook and the authenticated return from Checkout.
export async function confirmRentalAuthorization({
	stripe,
	supabase,
	session,
	reservationId,
	userId
}) {
	if (
		session.mode !== 'payment' ||
		session.metadata?.type !== 'rental' ||
		session.metadata.reservationId !== reservationId ||
		session.metadata.userId !== userId
	) {
		error(400, '予約情報が一致しません');
	}
	if (session.status !== 'complete' || !session.payment_intent)
		error(402, 'カードの確認が完了していません');
	const paymentIntent =
		typeof session.payment_intent === 'string'
			? await stripe.paymentIntents.retrieve(session.payment_intent)
			: session.payment_intent;
	if (!['requires_capture', 'succeeded'].includes(paymentIntent.status)) {
		error(402, 'カードの与信確保が完了していません');
	}
	const { data: reservation, error: readError } = await supabase
		.from('reservations')
		.select(`id, user_id, stall_id, status, start_datetime, end_datetime, ${RENTAL_PAYMENT_FIELDS}`)
		.eq('id', reservationId)
		.eq('user_id', userId)
		.single();
	if (readError) error(500, '予約情報を確認できませんでした');
	if (!reservation) error(404, '予約が見つかりません');
	if (!['pending', 'active', 'completed'].includes(reservation.status))
		error(409, 'この予約は確定できません');
	if (paymentIntent.currency !== 'jpy' || paymentIntent.amount !== rentalTotal(reservation)) {
		error(400, '予約の料金と支払い情報が一致しません');
	}
	if (reservation.stripe_payment_intent_id === paymentIntent.id) return paymentIntent.id;
	if (reservation.stripe_payment_intent_id) error(409, '別の支払いで確定済みです');
	// Another checkout may have finished while this user was entering card details.
	if (reservation.status === 'pending' && reservation.stall_id) {
		const { data: others, error: availabilityError } = await supabase
			.from('reservations')
			.select(`status, ${RENTAL_PAYMENT_FIELDS}`)
			.eq('stall_id', reservation.stall_id)
			.neq('id', reservationId)
			.in('status', ['pending', 'active']);
		if (availabilityError) error(500, '屋台の空き状況を確認できませんでした');
		if (others?.some(isRentalConfirmed)) {
			if (paymentIntent.status === 'requires_capture')
				await stripe.paymentIntents.cancel(paymentIntent.id);
			error(409, 'この屋台は別の予約が確定しました。別の屋台をお選びください。');
		}
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
