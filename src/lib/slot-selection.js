// 空き枠の選び方（ブラウザ側の純粋関数）
// 1回目のタップ = 開始、2回目のタップ = 終了（その枠まで含む）。日付をまたいでもよい。
// 範囲がすべて ○（free）のときだけ確定する。
import { SLOT_MS } from '$lib/rental-pricing.js';

/**
 * @param {{start:number,end:number,open:boolean}|null} selection
 * @param {number} slotMs タップした枠の開始時刻
 * @param {(ms:number)=>string|undefined} statusOf 枠の状態（free/busy/blocked/past）
 * @returns {{ selection: {start:number,end:number,open:boolean}|null, error: string }}
 */
export function nextSelection(selection, slotMs, statusOf) {
	if (statusOf(slotMs) !== 'free') {
		return { selection, error: 'この時間は予約できません（○の時間を選んでください）' };
	}
	if (!selection || !selection.open || slotMs < selection.start) {
		return { selection: { start: slotMs, end: slotMs + SLOT_MS, open: true }, error: '' };
	}
	for (let s = selection.start; s <= slotMs; s += SLOT_MS) {
		if (statusOf(s) !== 'free') {
			return { selection, error: '途中に予約できない時間があります。続いた○の時間を選んでください' };
		}
	}
	return { selection: { start: selection.start, end: slotMs + SLOT_MS, open: false }, error: '' };
}

export function isSelected(selection, slotMs) {
	return !!selection && slotMs >= selection.start && slotMs < selection.end;
}

const fmt = new Intl.DateTimeFormat('ja-JP', {
	timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
});
const fmtTime = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false });
const fmtDay = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short' });

/** 例: 10/20(火) 10:00 〜 14:00（4時間） / 日付をまたぐ場合は終了側にも日付 */
export function formatRange(startMs, endMs) {
	const sameDay = fmtDay.format(startMs) === fmtDay.format(endMs - 1);
	const minutes = Math.round((endMs - startMs) / 60000);
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	const dur = `${h ? `${h}時間` : ''}${m ? `${m}分` : ''}`;
	const endLabel = sameDay ? fmtTime.format(endMs) : fmt.format(endMs);
	return `${fmt.format(startMs)} 〜 ${endLabel}（${dur}）`.replace(/\s+/g, ' ');
}

/** 'YYYY-MM-DD'（日本時間）→ 10/20(火) */
export function formatDayTab(date) {
	return fmtDay.format(Date.parse(`${date}T12:00:00+09:00`));
}

/** サーバーへ送る日時（日本時間・+09:00 付き） */
export function toJstString(ms) {
	const d = new Date(ms + 9 * 3600000);
	return `${d.toISOString().slice(0, 19)}+09:00`;
}
