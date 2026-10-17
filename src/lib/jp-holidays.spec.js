import { describe, expect, it } from 'vitest';
import { jpHolidayName, jpHolidaysOf, isJpHoliday } from './jp-holidays.js';

describe('Japanese national holidays', () => {
	it('knows the 2026 holidays (内閣府の公表どおり)', () => {
		expect([...jpHolidaysOf(2026).keys()].sort()).toEqual([
			'2026-01-01', '2026-01-12', '2026-02-11', '2026-02-23', '2026-03-20', '2026-04-29',
			'2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06', '2026-07-20', '2026-08-11',
			'2026-09-21', '2026-09-22', '2026-09-23', '2026-10-12', '2026-11-03', '2026-11-23'
		]);
		expect(jpHolidayName('2026-05-06')).toBe('振替休日');
		expect(jpHolidayName('2026-09-22')).toBe('国民の休日');
	});
	it('knows the 2027 holidays', () => {
		expect([...jpHolidaysOf(2027).keys()].sort()).toEqual([
			'2027-01-01', '2027-01-11', '2027-02-11', '2027-02-23', '2027-03-21', '2027-03-22', '2027-04-29',
			'2027-05-03', '2027-05-04', '2027-05-05', '2027-07-19', '2027-08-11',
			'2027-09-20', '2027-09-23', '2027-10-11', '2027-11-03', '2027-11-23'
		]);
		expect(jpHolidayName('2027-03-22')).toBe('振替休日');
	});
	it('treats plain weekdays as normal days', () => {
		expect(isJpHoliday('2026-10-21')).toBe(false);
		expect(isJpHoliday('bad')).toBe(false);
	});
});
