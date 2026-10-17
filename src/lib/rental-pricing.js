// 屋台予約の料金計算（ブラウザ・サーバー共通の純粋関数）
//
// 料金 = 屋台と場所それぞれの「3時間の基本料金」＋「30分ごとの延長料」の合計。
// - 30分から予約できるが、3時間未満でも基本料金（3時間分）を請求する
// - 早く返却しても予約した時間分を請求する（予約終了と実際の返却の遅い方まで）
// - 予約時間を過ぎた分は30分単位（切り上げ）で延長料を加算する
// - 無断キャンセルは基本料金（屋台＋場所の3時間分）を請求する

export const SLOT_MINUTES = 30;
export const BASE_MINUTES = 180;
export const BUFFER_SLOTS = 1;
export const BOOKING_HORIZON_DAYS = 14;
export const SLOT_MS = SLOT_MINUTES * 60 * 1000;

/** タイムゾーンの無い日時文字列は日本時間として扱い、+09:00 付きの文字列にする */
export function toJstIso(value) {
	if (typeof value !== 'string' || !value) return null;
	const s = value.trim();
	if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(s)) return s;
	const withSeconds = /T\d{2}:\d{2}$/.test(s) ? `${s}:00` : s;
	return `${withSeconds}+09:00`;
}

function fee(value) {
	const n = Number(value ?? 0);
	if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) throw new Error('料金設定が正しくありません');
	return n;
}

/** 予約行（locked_* 列）から料金設定を取り出す */
export function feesFromReservation(r) {
	return {
		stallBase: fee(r.locked_stall_fee),
		stallExt: fee(r.locked_stall_ext_fee),
		spaceBase: fee(r.locked_space_fee),
		spaceExt: fee(r.locked_space_ext_fee)
	};
}

/** 請求対象の分数（30分単位で切り上げ、最低3時間） */
export function billedMinutes(startMs, endMs) {
	const slots = Math.ceil((endMs - startMs) / SLOT_MS);
	return Math.max(BASE_MINUTES, slots * SLOT_MINUTES);
}

/**
 * 料金を計算する。
 * @param {{ start: string|number, end: string|number, returnedAt?: string|number|null, fees: {stallBase:number, stallExt:number, spaceBase:number, spaceExt:number} }} p
 */
export function rentalCharge({ start, end, returnedAt = null, fees }) {
	const startMs = typeof start === 'number' ? start : Date.parse(start);
	const endMs = typeof end === 'number' ? end : Date.parse(end);
	if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
		throw new Error('予約日時が正しくありません');
	}
	const returnedMs = returnedAt == null ? null : typeof returnedAt === 'number' ? returnedAt : Date.parse(returnedAt);
	const effectiveEnd = Number.isFinite(returnedMs) ? Math.max(endMs, returnedMs) : endMs;
	const f = {
		stallBase: fee(fees?.stallBase),
		stallExt: fee(fees?.stallExt),
		spaceBase: fee(fees?.spaceBase),
		spaceExt: fee(fees?.spaceExt)
	};
	const minutes = billedMinutes(startMs, effectiveEnd);
	const extensionSlots = (minutes - BASE_MINUTES) / SLOT_MINUTES;
	const stall = f.stallBase + extensionSlots * f.stallExt;
	const space = f.spaceBase + extensionSlots * f.spaceExt;
	return {
		minutes,
		extensionSlots,
		base: f.stallBase + f.spaceBase,
		extension: extensionSlots * (f.stallExt + f.spaceExt),
		stall,
		space,
		total: stall + space
	};
}

/** 無断キャンセル時の請求額 = 基本料金（屋台＋場所の3時間分） */
export function noShowCharge(fees) {
	return fee(fees?.stallBase) + fee(fees?.spaceBase);
}
