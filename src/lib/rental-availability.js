// 屋台の空き枠の計算（ブラウザ・サーバー共通の純粋関数）
// 30分ごとの枠を日本時間で並べ、各枠を次のどれかにする:
//   free（○予約できる） / busy（×他の人が使用中。前後1枠のゆとりを含む）
//   blocked（ー貸し出し不可の時間帯） / past（過ぎた時間）
import { SLOT_MINUTES, SLOT_MS, BUFFER_SLOTS, BOOKING_HORIZON_DAYS, toJstIso } from '$lib/rental-pricing.js';
import { isRentalConfirmed } from '$lib/rental-payment.js';

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES;

/** 'YYYY-MM-DD'（日本時間）の0時の時刻 */
export function jstDayStartMs(date) {
	return Date.parse(`${date}T00:00:00+09:00`);
}

/** 時刻 → 日本時間の日付・曜日（0=日）・0時からの分 */
export function jstParts(ms) {
	const d = new Date(ms + JST_OFFSET_MS);
	return {
		date: d.toISOString().slice(0, 10),
		weekday: d.getUTCDay(),
		minutes: d.getUTCHours() * 60 + d.getUTCMinutes()
	};
}

/** 今日の日付（日本時間） */
export function jstToday(now = Date.now()) {
	return jstParts(now).date;
}

function timeToMinutes(t, fallback) {
	if (typeof t !== 'string') return fallback;
	const [h, m] = t.split(':').map(Number);
	return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : fallback;
}

/** その枠が貸し出し不可の時間帯に入っているか */
export function isBlackedOut(slotStartMs, blackouts = []) {
	const { date, weekday, minutes } = jstParts(slotStartMs);
	const slotEnd = minutes + SLOT_MINUTES;
	return blackouts.some((b) => {
		const appliesToDay =
			b.on_date != null ? b.on_date === date : b.weekday != null ? Number(b.weekday) === weekday : true;
		if (!appliesToDay) return false;
		const from = timeToMinutes(b.start_time, 0);
		const to = timeToMinutes(b.end_time, 24 * 60);
		return minutes < to && slotEnd > from;
	});
}

/** 確定済みの予約から、使用中の時間（前後のゆとり枠を含む）を作る */
export function busyIntervals(reservations = [], { excludeId = null } = {}) {
	const buffer = BUFFER_SLOTS * SLOT_MS;
	return reservations
		.filter((r) => r.id !== excludeId)
		.filter((r) => (r.status === 'pending' || r.status === 'active') && isRentalConfirmed(r))
		.map((r) => ({
			start: Date.parse(toJstIso(r.start_datetime)) - buffer,
			end: Date.parse(toJstIso(r.end_datetime)) + buffer
		}))
		.filter((i) => Number.isFinite(i.start) && Number.isFinite(i.end));
}

function overlaps(aStart, aEnd, intervals) {
	return intervals.some((i) => aStart < i.end && aEnd > i.start);
}

/** 1枠の状態 */
export function slotStatus(slotStartMs, { busy = [], blackouts = [], now = Date.now() }) {
	if (slotStartMs + SLOT_MS <= now) return 'past';
	if (isBlackedOut(slotStartMs, blackouts)) return 'blocked';
	if (overlaps(slotStartMs, slotStartMs + SLOT_MS, busy)) return 'busy';
	return 'free';
}

/** 指定日から days 日分の空き枠を作る */
export function buildSlots({ from, days = BOOKING_HORIZON_DAYS, reservations = [], blackouts = [], now = Date.now() }) {
	const busy = busyIntervals(reservations);
	const startDay = jstDayStartMs(from);
	const out = [];
	for (let d = 0; d < days; d++) {
		const dayStart = startDay + d * DAY_MS;
		const { date, weekday } = jstParts(dayStart);
		const slots = [];
		for (let i = 0; i < SLOTS_PER_DAY; i++) {
			const s = dayStart + i * SLOT_MS;
			slots.push({ start: new Date(s).toISOString(), status: slotStatus(s, { busy, blackouts, now }) });
		}
		out.push({ date, weekday, slots });
	}
	return out;
}

/**
 * 予約したい時間帯が予約可能か確認する。予約できない場合は理由を返す。
 * @returns {null | 'invalid' | 'unaligned' | 'past' | 'too_far' | 'blocked' | 'busy'}
 */
export function checkRange({ start, end, reservations = [], blackouts = [], now = Date.now(), excludeId = null }) {
	const startMs = Date.parse(toJstIso(start));
	const endMs = Date.parse(toJstIso(end));
	if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 'invalid';
	if (startMs % SLOT_MS !== 0 || endMs % SLOT_MS !== 0) return 'unaligned';
	if (startMs < now - SLOT_MS) return 'past';
	const horizonEnd = jstDayStartMs(jstToday(now)) + BOOKING_HORIZON_DAYS * DAY_MS;
	if (startMs >= horizonEnd) return 'too_far';
	for (let s = startMs; s < endMs; s += SLOT_MS) {
		if (isBlackedOut(s, blackouts)) return 'blocked';
	}
	if (overlaps(startMs, endMs, busyIntervals(reservations, { excludeId }))) return 'busy';
	return null;
}

export const RANGE_ERROR_MESSAGES = {
	invalid: '利用日時が正しくありません',
	unaligned: '予約は30分単位（00分・30分）で指定してください',
	past: '過去の日時は予約できません',
	too_far: `予約できるのは${BOOKING_HORIZON_DAYS}日先までです`,
	blocked: 'この時間帯は貸し出しを行っていません',
	busy: 'この時間帯は他の予約と重なっています（前後30分は準備・片付けの時間として空けています）'
};
