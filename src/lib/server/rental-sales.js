import { error } from '@sveltejs/kit';

const MAX_SALES_KEYS = 100;
const MAX_SALES_COUNT = 100000;

/** 売上明細 { 品目名: 個数 } を検証して返す（不正なら 400） */
export function sanitizeSalesItems(input) {
	if (input == null) return {};
	if (typeof input !== 'object' || Array.isArray(input)) error(400, '売上の形式が正しくありません');
	const entries = Object.entries(input);
	if (entries.length > MAX_SALES_KEYS) error(400, '売上の品目が多すぎます');
	const out = {};
	for (const [name, count] of entries) {
		const n = Number(count);
		if (typeof name !== 'string' || name.length === 0 || name.length > 100) error(400, '品目名が正しくありません');
		if (!Number.isInteger(n) || n < 0 || n > MAX_SALES_COUNT) error(400, '販売個数が正しくありません');
		out[name] = n;
	}
	return out;
}
