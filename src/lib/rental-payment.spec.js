import { describe, expect, it } from 'vitest';
import {
	isFreeRental,
	isRentalConfirmed,
	isUnfinishedCheckout,
	rentalTotal
} from './rental-payment.js';

const draft = {
	status: 'pending',
	locked_space_fee: 0,
	locked_stall_fee: 1000,
	stripe_payment_intent_id: null
};

describe('rental checkout state', () => {
	it('does not reserve a stall when the user returns without authorizing payment', () => {
		expect(isRentalConfirmed(draft)).toBe(false);
		expect(isUnfinishedCheckout(draft)).toBe(true);
	});
	it('confirms an authorized booking without marking it active', () => {
		const authorized = { ...draft, stripe_payment_intent_id: 'pi_authorized' };
		expect(isRentalConfirmed(authorized)).toBe(true);
		expect(isUnfinishedCheckout(authorized)).toBe(false);
		expect(authorized.status).toBe('pending');
	});
	it('keeps free rentals bookable without treating unknown fees as free', () => {
		expect(isRentalConfirmed({ ...draft, locked_stall_fee: 0 })).toBe(true);
		expect(isFreeRental({ ...draft, locked_stall_fee: null })).toBe(false);
		expect(isRentalConfirmed({ status: 'pending' })).toBe(false);
	});
	it.each(['cancelled', 'auto_cancelled'])(
		'does not resurrect %s bookings with a payment ID',
		(status) => {
			expect(
				isRentalConfirmed({ ...draft, status, stripe_payment_intent_id: 'pi_authorized' })
			).toBe(false);
		}
	);
	it('preserves past rentals and excludes legacy unconfirmed rows', () => {
		expect(isRentalConfirmed({ status: 'active' })).toBe(true);
		expect(isRentalConfirmed({ status: 'completed' })).toBe(true);
		expect(isUnfinishedCheckout({ ...draft, status: null })).toBe(true);
	});
	it('calculates the locked price and rejects malformed dates', () => {
		const reservation = {
			...draft,
			start_datetime: '2026-10-20T10:00:00+09:00',
			end_datetime: '2026-10-21T12:00:00+09:00'
		};
		// 26時間 = 基本3時間 + 延長46枠。屋台1,000円(延長0円) → 1,000円
		expect(rentalTotal(reservation)).toBe(1000);
		// 延長料を設定した場合: 1,000 + 46 × (200 + 100)
		expect(
			rentalTotal({ ...reservation, locked_stall_ext_fee: 200, locked_space_fee: 500, locked_space_ext_fee: 100 })
		).toBe(1500 + 46 * 300);
		expect(() => rentalTotal({ ...reservation, end_datetime: 'invalid' })).toThrow();
		expect(() => rentalTotal({ ...reservation, locked_stall_fee: null })).toThrow();
	});
});
