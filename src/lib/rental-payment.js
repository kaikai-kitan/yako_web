import { rentalCharge, feesFromReservation } from '$lib/rental-pricing.js';

// A pending row is a checkout draft until card authorization succeeds.
// Zero-fee reservations do not need Stripe; unknown fees must not count as free.
export const RENTAL_PAYMENT_FIELDS =
	'stripe_payment_intent_id, locked_space_fee, locked_stall_fee, locked_space_ext_fee, locked_stall_ext_fee';

// v13 may not yet be installed. Keep the map readable, but never infer paid
// authorization from a legacy pending row without the payment-intent column.
export async function readRentalRows(buildQuery, fields) {
	let result = await buildQuery(fields);
	if (
		['42703', 'PGRST204'].includes(result.error?.code) &&
		result.error.message?.includes('stripe_payment_intent_id')
	) {
		result = await buildQuery(fields.replace(/stripe_payment_intent_id,?\s*/g, ''));
	}
	return result;
}

export function isFreeRental(reservation) {
	return (
		reservation.locked_space_fee != null &&
		reservation.locked_stall_fee != null &&
		Number(reservation.locked_space_fee) === 0 &&
		Number(reservation.locked_stall_fee) === 0 &&
		Number(reservation.locked_space_ext_fee ?? 0) === 0 &&
		Number(reservation.locked_stall_ext_fee ?? 0) === 0
	);
}

export function isRentalConfirmed(reservation) {
	if (reservation.status === 'active' || reservation.status === 'completed') return true;
	return (
		reservation.status === 'pending' &&
		(Boolean(reservation.stripe_payment_intent_id) || isFreeRental(reservation))
	);
}

export function isUnfinishedCheckout(reservation) {
	return (
		(reservation.status === 'pending' || reservation.status == null) &&
		!isRentalConfirmed(reservation)
	);
}

/** 予約時間分の料金（3時間の基本料金＋30分ごとの延長料、屋台と場所の合算） */
export function rentalTotal(reservation) {
	if (reservation.locked_space_fee == null || reservation.locked_stall_fee == null) {
		throw new Error('予約日時または料金が正しくありません');
	}
	return rentalCharge({
		start: reservation.start_datetime,
		end: reservation.end_datetime,
		fees: feesFromReservation(reservation)
	}).total;
}
