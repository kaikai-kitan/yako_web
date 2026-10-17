// 土日・イベントなどの割増率（ブラウザ・サーバー共通の純粋関数）
// 予約の開始日（日本時間）に当てはまるルールの倍率を、屋台・場所の料金に掛ける。
// 複数当てはまる場合は一番高い倍率を使う。
import { jstParts } from '$lib/rental-availability.js';

/** その日・その屋台／場所に当てはまる割増ルール（無ければ null） */
export function matchPriceRule(startMs, rules = [], { stallId = null, spaceId = null } = {}) {
	const { date, weekday } = jstParts(startMs);
	let best = null;
	for (const r of rules) {
		if (r.active === false) continue;
		if (r.stall_id && r.stall_id !== stallId) continue;
		if (r.rental_space_id && r.rental_space_id !== spaceId) continue;
		if (r.weekday != null && Number(r.weekday) !== weekday) continue;
		if (r.start_date && date < r.start_date) continue;
		if (r.end_date && date > r.end_date) continue;
		if (r.weekday == null && !r.start_date) continue;
		const m = Number(r.multiplier);
		if (!Number.isFinite(m) || m <= 0) continue;
		if (!best || m > Number(best.multiplier)) best = r;
	}
	return best;
}

/** 倍率を掛けた料金（円未満は四捨五入） */
export function applyMultiplier(fees, multiplier = 1) {
	const m = Number(multiplier) || 1;
	const round = (n) => Math.round(Number(n ?? 0) * m);
	return {
		stallBase: round(fees.stallBase),
		stallExt: round(fees.stallExt),
		spaceBase: round(fees.spaceBase),
		spaceExt: round(fees.spaceExt)
	};
}
