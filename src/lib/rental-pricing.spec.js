import { describe, expect, it } from 'vitest';
import { rentalCharge, noShowCharge, billedMinutes, toJstIso } from './rental-pricing.js';

const fees = { stallBase: 1000, stallExt: 200, spaceBase: 500, spaceExt: 100 };
const at = (hhmm) => `2026-10-20T${hhmm}:00+09:00`;

describe('rental pricing (3-hour base + 30-minute extensions)', () => {
	it('charges the base fee even for a 30-minute booking', () => {
		expect(rentalCharge({ start: at('10:00'), end: at('10:30'), fees }).total).toBe(1500);
	});
	it('matches the design example: 4 hours = 2,100 yen', () => {
		const c = rentalCharge({ start: at('10:00'), end: at('14:00'), fees });
		expect(c).toMatchObject({ minutes: 240, extensionSlots: 2, base: 1500, extension: 600, stall: 1400, space: 700, total: 2100 });
	});
	it('charges the reserved time even when returned early', () => {
		expect(rentalCharge({ start: at('10:00'), end: at('14:00'), returnedAt: at('10:05'), fees }).total).toBe(2100);
	});
	it('adds 30-minute units (rounded up) when returned late', () => {
		// 14:10 返却 → 14:30 まで（延長3枠）
		expect(rentalCharge({ start: at('10:00'), end: at('14:00'), returnedAt: at('14:10'), fees }).total).toBe(2400);
	});
	it('rounds partial slots up and never bills less than 3 hours', () => {
		expect(billedMinutes(0, 200 * 60000)).toBe(210);
		expect(billedMinutes(0, 60 * 60000)).toBe(180);
	});
	it('charges the base fee (stall + place, 3 hours) for a no-show', () => {
		expect(noShowCharge(fees)).toBe(1500);
	});
	it('rejects broken dates and fee settings', () => {
		expect(() => rentalCharge({ start: at('10:00'), end: at('09:00'), fees })).toThrow();
		expect(() => rentalCharge({ start: at('10:00'), end: at('13:00'), fees: { ...fees, stallBase: -1 } })).toThrow();
	});
	it('treats datetimes without a timezone as Japan time', () => {
		expect(toJstIso('2026-10-20T10:00')).toBe('2026-10-20T10:00:00+09:00');
		expect(toJstIso('2026-10-20T10:00:00')).toBe('2026-10-20T10:00:00+09:00');
		expect(toJstIso('2026-10-20T01:00:00Z')).toBe('2026-10-20T01:00:00Z');
		expect(Date.parse(toJstIso('2026-10-20T10:00:00'))).toBe(Date.parse('2026-10-20T01:00:00Z'));
	});
});
