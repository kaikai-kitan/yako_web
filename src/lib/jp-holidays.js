// 日本の祝日の判定（ブラウザ・サーバー共通の純粋関数）
// 「国民の祝日に関する法律」の現行ルール（2020年以降）で計算する。
// - 固定の祝日、ハッピーマンデー、春分・秋分の日（近似式。2099年まで有効）
// - 振替休日（祝日が日曜なら、その後の最初の平日でない日まで繰り下げ）
// - 国民の休日（祝日に挟まれた平日）
// 臨時の祝日（例: 2019年の即位の日）は含まない。必要なら割増率の「期間」で設定する。

const pad = (n) => String(n).padStart(2, '0');
const key = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

/** その月の第n月曜日の日付 */
function nthMonday(y, m, n) {
	const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
	const firstMonday = 1 + ((8 - first) % 7);
	return firstMonday + (n - 1) * 7;
}

function equinoxDays(y) {
	const t = y - 1980;
	return {
		spring: Math.floor(20.8431 + 0.242194 * t - Math.floor(t / 4)),
		autumn: Math.floor(23.2488 + 0.242194 * t - Math.floor(t / 4))
	};
}

/** 振替・国民の休日を除く、法律で決まった祝日（名前つき） */
function baseHolidays(y) {
	const { spring, autumn } = equinoxDays(y);
	return new Map([
		[key(y, 1, 1), '元日'],
		[key(y, 1, nthMonday(y, 1, 2)), '成人の日'],
		[key(y, 2, 11), '建国記念の日'],
		[key(y, 2, 23), '天皇誕生日'],
		[key(y, 3, spring), '春分の日'],
		[key(y, 4, 29), '昭和の日'],
		[key(y, 5, 3), '憲法記念日'],
		[key(y, 5, 4), 'みどりの日'],
		[key(y, 5, 5), 'こどもの日'],
		[key(y, 7, nthMonday(y, 7, 3)), '海の日'],
		[key(y, 8, 11), '山の日'],
		[key(y, 9, nthMonday(y, 9, 3)), '敬老の日'],
		[key(y, 9, autumn), '秋分の日'],
		[key(y, 10, nthMonday(y, 10, 2)), 'スポーツの日'],
		[key(y, 11, 3), '文化の日'],
		[key(y, 11, 23), '勤労感謝の日']
	]);
}

const cache = new Map();

/** その年の祝日（振替休日・国民の休日を含む）。Map<'YYYY-MM-DD', 名前> */
export function jpHolidaysOf(y) {
	if (cache.has(y)) return cache.get(y);
	const base = baseHolidays(y);
	const all = new Map(base);
	const dayMs = 86400000;
	const toKey = (ms) => {
		const d = new Date(ms);
		return key(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
	};
	for (const k of base.keys()) {
		const ms = Date.parse(`${k}T00:00:00Z`);
		// 振替休日
		if (new Date(ms).getUTCDay() === 0) {
			let next = ms + dayMs;
			while (all.has(toKey(next))) next += dayMs;
			all.set(toKey(next), '振替休日');
		}
		// 国民の休日（前後が祝日で、日曜でもない日）
		const between = ms + dayMs;
		const after = toKey(between + dayMs);
		if (base.has(after) && !all.has(toKey(between)) && new Date(between).getUTCDay() !== 0) {
			all.set(toKey(between), '国民の休日');
		}
	}
	cache.set(y, all);
	return all;
}

/** 'YYYY-MM-DD' が祝日なら名前、そうでなければ null */
export function jpHolidayName(date) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return null;
	return jpHolidaysOf(Number(date.slice(0, 4))).get(date) ?? null;
}

export const isJpHoliday = (date) => jpHolidayName(date) != null;
