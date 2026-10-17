import { describe, expect, it } from 'vitest';
import { buildSlots, checkRange, isBlackedOut, jstParts } from './rental-availability.js';

const day = '2026-10-20'; // 火曜日
const now = Date.parse('2026-10-19T12:00:00+09:00');
const at = (hhmm) => `${day}T${hhmm}:00+09:00`;
const confirmed = (from, to) => ({
	id: `r-${from}`,
	status: 'pending',
	start_datetime: at(from),
	end_datetime: at(to),
	stripe_payment_intent_id: 'pi',
	locked_stall_fee: 1000,
	locked_space_fee: 0
});
const statusAt = (slots, hhmm) => slots[0].slots.find((s) => s.start === new Date(at(hhmm)).toISOString()).status;

describe('slot availability', () => {
	it('lists 48 thirty-minute slots per day in Japan time', () => {
		const days = buildSlots({ from: day, days: 2, now });
		expect(days).toHaveLength(2);
		expect(days[0].slots).toHaveLength(48);
		expect(days[0].weekday).toBe(2);
		expect(days[0].slots[0].start).toBe('2026-10-19T15:00:00.000Z');
	});
	it('marks the booking and one gap slot before and after as busy', () => {
		const slots = buildSlots({ from: day, days: 1, reservations: [confirmed('10:00', '13:00')], now });
		expect(statusAt(slots, '09:00')).toBe('free');
		expect(statusAt(slots, '09:30')).toBe('busy');
		expect(statusAt(slots, '12:30')).toBe('busy');
		expect(statusAt(slots, '13:00')).toBe('busy');
		expect(statusAt(slots, '13:30')).toBe('free');
	});
	it('ignores unpaid drafts and cancelled bookings', () => {
		const draft = { ...confirmed('10:00', '13:00'), stripe_payment_intent_id: null };
		const cancelled = { ...confirmed('10:00', '13:00'), status: 'cancelled' };
		const slots = buildSlots({ from: day, days: 1, reservations: [draft, cancelled], now });
		expect(statusAt(slots, '10:00')).toBe('free');
	});
	it('applies weekly and one-day blackouts', () => {
		const tuesdayNight = { weekday: 2, on_date: null, start_time: '00:00', end_time: '08:00' };
		const oneDay = { weekday: null, on_date: day, start_time: '20:00', end_time: '24:00' };
		const slots = buildSlots({ from: day, days: 1, blackouts: [tuesdayNight, oneDay], now });
		expect(statusAt(slots, '07:30')).toBe('blocked');
		expect(statusAt(slots, '08:00')).toBe('free');
		expect(statusAt(slots, '23:30')).toBe('blocked');
		expect(isBlackedOut(Date.parse('2026-10-21T07:00:00+09:00'), [tuesdayNight])).toBe(false);
	});
	it('marks past slots', () => {
		const slots = buildSlots({ from: day, days: 1, now: Date.parse(at('11:10')) });
		expect(statusAt(slots, '10:30')).toBe('past');
		expect(statusAt(slots, '11:00')).toBe('free');
	});
	it('checks a requested range against the same rules', () => {
		const reservations = [confirmed('10:00', '13:00')];
		expect(checkRange({ start: at('13:30'), end: at('16:30'), reservations, now })).toBeNull();
		expect(checkRange({ start: at('13:00'), end: at('16:00'), reservations, now })).toBe('busy');
		expect(checkRange({ start: at('06:00'), end: at('10:00'), reservations, now })).toBe('busy');
		expect(checkRange({ start: at('06:00'), end: at('09:30'), reservations, now })).toBeNull();
		expect(checkRange({ start: at('10:15'), end: at('13:15'), now })).toBe('unaligned');
		expect(checkRange({ start: '2026-11-20T10:00:00+09:00', end: '2026-11-20T13:00:00+09:00', now })).toBe('too_far');
		expect(checkRange({ start: at('10:00'), end: at('09:00'), now })).toBe('invalid');
	});
	it('converts to Japan time parts', () => {
		expect(jstParts(Date.parse('2026-10-19T15:30:00Z'))).toEqual({ date: '2026-10-20', weekday: 2, minutes: 30 });
	});
});
