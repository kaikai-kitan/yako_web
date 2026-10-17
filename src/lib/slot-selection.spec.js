import { describe, expect, it } from 'vitest';
import { nextSelection, isSelected, formatRange, toJstString } from './slot-selection.js';

const t = (hhmm, day = '2026-10-20') => Date.parse(`${day}T${hhmm}:00+09:00`);
const busy = new Set([t('13:00'), t('13:30')]);
const statusOf = (ms) => (busy.has(ms) ? 'busy' : 'free');

describe('slot selection', () => {
	it('first tap sets the start, second tap sets the end (inclusive)', () => {
		const a = nextSelection(null, t('10:00'), statusOf).selection;
		expect(a).toEqual({ start: t('10:00'), end: t('10:30'), open: true });
		const b = nextSelection(a, t('12:00'), statusOf).selection;
		expect(b).toEqual({ start: t('10:00'), end: t('12:30'), open: false });
		expect(isSelected(b, t('12:00'))).toBe(true);
		expect(isSelected(b, t('12:30'))).toBe(false);
	});
	it('refuses a range that crosses a busy slot and keeps the start', () => {
		const a = nextSelection(null, t('10:00'), statusOf).selection;
		const r = nextSelection(a, t('15:00'), statusOf);
		expect(r.error).toMatch(/途中/);
		expect(r.selection).toBe(a);
	});
	it('refuses tapping a busy slot', () => {
		expect(nextSelection(null, t('13:00'), statusOf).error).toMatch(/予約できません/);
	});
	it('starts over when tapping before the start or after a finished range', () => {
		const a = nextSelection(null, t('10:00'), statusOf).selection;
		expect(nextSelection(a, t('09:00'), statusOf).selection.start).toBe(t('09:00'));
		const done = { start: t('10:00'), end: t('11:00'), open: false };
		expect(nextSelection(done, t('15:00'), statusOf).selection).toEqual({ start: t('15:00'), end: t('15:30'), open: true });
	});
	it('allows an overnight range across days', () => {
		const a = nextSelection(null, t('22:00'), statusOf).selection;
		const b = nextSelection(a, t('01:30', '2026-10-21'), statusOf).selection;
		expect(b.end - b.start).toBe(4 * 3600000);
	});
	it('formats ranges and JST strings', () => {
		expect(formatRange(t('10:00'), t('14:00'))).toContain('4時間');
		expect(formatRange(t('22:00'), t('02:00', '2026-10-21'))).toContain('10/21');
		expect(toJstString(t('10:00'))).toBe('2026-10-20T10:00:00+09:00');
	});
});
