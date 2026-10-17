import { describe, expect, it } from 'vitest';
import { matchPriceRule, applyMultiplier } from './rental-price-rules.js';

const sat = Date.parse('2026-10-24T10:00:00+09:00');
const tue = Date.parse('2026-10-20T10:00:00+09:00');
const weekend = [
	{ id: 'sat', label: '土曜', multiplier: 1.2, weekday: 6 },
	{ id: 'sun', label: '日曜', multiplier: 1.2, weekday: 0 }
];
const festival = { id: 'fes', label: '鴨川まつり', multiplier: 1.5, start_date: '2026-10-24', end_date: '2026-10-25' };

describe('price rules (multipliers)', () => {
	it('applies weekend rates by weekday in Japan time', () => {
		expect(matchPriceRule(sat, weekend)?.multiplier).toBe(1.2);
		expect(matchPriceRule(tue, weekend)).toBeNull();
		// 金曜 23:30 UTC = 土曜 08:30 JST
		expect(matchPriceRule(Date.parse('2026-10-23T23:30:00Z'), weekend)?.id).toBe('sat');
	});
	it('uses the highest matching rate', () => {
		expect(matchPriceRule(sat, [...weekend, festival])?.id).toBe('fes');
	});
	it('limits rules to a stall or a place when set', () => {
		const onlyA = { ...festival, stall_id: 'A' };
		expect(matchPriceRule(sat, [onlyA], { stallId: 'B' })).toBeNull();
		expect(matchPriceRule(sat, [onlyA], { stallId: 'A' })?.id).toBe('fes');
	});
	it('ignores inactive rules and dates outside the range', () => {
		expect(matchPriceRule(sat, [{ ...festival, active: false }])).toBeNull();
		expect(matchPriceRule(Date.parse('2026-10-26T10:00:00+09:00'), [festival])).toBeNull();
	});
	it('multiplies each fee and rounds to whole yen', () => {
		expect(applyMultiplier({ stallBase: 1500, stallExt: 500, spaceBase: 1000, spaceExt: 0 }, 1.2)).toEqual({
			stallBase: 1800, stallExt: 600, spaceBase: 1200, spaceExt: 0
		});
		expect(applyMultiplier({ stallBase: 999, stallExt: 0, spaceBase: 0, spaceExt: 0 }, 1.15).stallBase).toBe(1149);
	});
});

describe('weekend and holiday rules', () => {
	const rule = { id: 'wh', label: '土日祝', multiplier: 1.2, day_set: 'weekend_holiday' };
	const holidayOnly = { id: 'h', label: '祝日', multiplier: 1.3, day_set: 'holiday' };
	const at = (d) => Date.parse(`${d}T12:00:00+09:00`);
	it('covers Saturdays, Sundays and national holidays with one rule', () => {
		expect(matchPriceRule(at('2026-10-24'), [rule])?.id).toBe('wh'); // 土
		expect(matchPriceRule(at('2026-10-25'), [rule])?.id).toBe('wh'); // 日
		expect(matchPriceRule(at('2026-11-03'), [rule])?.id).toBe('wh'); // 文化の日（火）
		expect(matchPriceRule(at('2026-10-21'), [rule])).toBeNull(); // 平日
	});
	it('matches holidays only', () => {
		expect(matchPriceRule(at('2026-11-23'), [holidayOnly])?.id).toBe('h'); // 勤労感謝の日（月）
		expect(matchPriceRule(at('2026-10-24'), [holidayOnly])).toBeNull(); // ただの土曜
	});
});
