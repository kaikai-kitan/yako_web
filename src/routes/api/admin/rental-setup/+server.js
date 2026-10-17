import { json, error } from '@sveltejs/kit';
import { assertAdmin, serviceClient, UUID_RE, DATE_RE, TIME_RE, yen } from '$lib/server/admin.js';

export const prerender = false;

/** 屋台・場所・紐づけ・料金・貸し出し不可の時間帯・割増率の一覧 */
export async function GET({ cookies }) {
	assertAdmin(cookies);
	const supabase = serviceClient();
	const [stalls, spaces, blackouts, rules] = await Promise.all([
		supabase.from('stall_specs').select('id, stall_name, rental_fee, extension_fee, space_id, operators ( business_name )').order('created_at', { ascending: true }),
		supabase.from('rental_spaces').select('id, name, address, space_fee, extension_fee, owners ( owner_name )').order('created_at', { ascending: true }),
		supabase.from('rental_blackouts').select('id, stall_id, rental_space_id, weekday, on_date, start_time, end_time, note').order('created_at', { ascending: true }),
		supabase.from('rental_price_rules').select('id, label, multiplier, weekday, start_date, end_date, stall_id, rental_space_id, active').order('created_at', { ascending: true })
	]);
	for (const r of [stalls, spaces, blackouts, rules]) if (r.error) error(500, r.error.message);
	return json({ stalls: stalls.data, spaces: spaces.data, blackouts: blackouts.data, rules: rules.data });
}

const optionalId = (v, label) => {
	if (v == null || v === '') return null;
	if (typeof v !== 'string' || !UUID_RE.test(v)) error(400, `${label}の指定が正しくありません`);
	return v;
};
const weekdayOrNull = (v) => {
	if (v == null || v === '') return null;
	const n = Number(v);
	if (!Number.isInteger(n) || n < 0 || n > 6) error(400, '曜日の指定が正しくありません');
	return n;
};
const dateOrNull = (v) => {
	if (v == null || v === '') return null;
	if (!DATE_RE.test(v)) error(400, '日付の形式が正しくありません');
	return v;
};

/** 設定の変更（action ごと） */
export async function POST({ request, cookies }) {
	assertAdmin(cookies);
	const supabase = serviceClient();
	const body = await request.json().catch(() => ({}));
	const run = async (q) => {
		const { error: e } = await q;
		if (e) error(500, e.message);
		return json({ ok: true });
	};

	switch (body.action) {
		case 'link': {
			const stallId = optionalId(body.stallId, '屋台');
			if (!stallId) error(400, '屋台を指定してください');
			const spaceId = optionalId(body.spaceId, '場所');
			return run(supabase.from('stall_specs').update({ space_id: spaceId }).eq('id', stallId));
		}
		case 'fees': {
			const id = optionalId(body.id, body.kind === 'space' ? '場所' : '屋台');
			if (!id) error(400, '対象を指定してください');
			const base = yen(body.base, '基本料金');
			const ext = yen(body.ext, '延長料金');
			if (body.kind === 'stall') return run(supabase.from('stall_specs').update({ rental_fee: base, extension_fee: ext }).eq('id', id));
			if (body.kind === 'space') return run(supabase.from('rental_spaces').update({ space_fee: base, extension_fee: ext }).eq('id', id));
			error(400, '対象の種類が正しくありません');
		}
		case 'addBlackout': {
			const stallId = optionalId(body.stallId, '屋台');
			const spaceId = optionalId(body.spaceId, '場所');
			if (!stallId && !spaceId) error(400, '屋台または場所を指定してください');
			const weekday = weekdayOrNull(body.weekday);
			const onDate = dateOrNull(body.onDate);
			if (weekday != null && onDate) error(400, '曜日と日付はどちらか一方を指定してください');
			const start = body.startTime || '00:00';
			const end = body.endTime || '24:00';
			if (!TIME_RE.test(start) || !TIME_RE.test(end) || end <= start) error(400, '時間帯が正しくありません');
			return run(supabase.from('rental_blackouts').insert({
				stall_id: stallId, rental_space_id: spaceId, weekday, on_date: onDate,
				start_time: start, end_time: end, note: typeof body.note === 'string' ? body.note.slice(0, 200) : null
			}));
		}
		case 'deleteBlackout': {
			const id = optionalId(body.id, '貸し出し不可の設定');
			return run(supabase.from('rental_blackouts').delete().eq('id', id));
		}
		case 'addRule': {
			const label = typeof body.label === 'string' ? body.label.trim().slice(0, 60) : '';
			if (!label) error(400, '名前を入力してください（例：土日料金、鴨川まつり）');
			const multiplier = Number(body.multiplier);
			if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 10) error(400, '倍率は0より大きく10以下で入力してください');
			const weekday = weekdayOrNull(body.weekday);
			const startDate = dateOrNull(body.startDate);
			const endDate = dateOrNull(body.endDate) ?? startDate;
			if (weekday == null && !startDate) error(400, '曜日か期間を指定してください');
			if (startDate && endDate && endDate < startDate) error(400, '期間の終わりが始まりより前です');
			return run(supabase.from('rental_price_rules').insert({
				label, multiplier: Math.round(multiplier * 100) / 100, weekday, start_date: startDate, end_date: endDate,
				stall_id: optionalId(body.stallId, '屋台'), rental_space_id: optionalId(body.spaceId, '場所'), active: true
			}));
		}
		case 'toggleRule': {
			const id = optionalId(body.id, '割増率');
			return run(supabase.from('rental_price_rules').update({ active: !!body.active }).eq('id', id));
		}
		case 'deleteRule': {
			const id = optionalId(body.id, '割増率');
			return run(supabase.from('rental_price_rules').delete().eq('id', id));
		}
		default:
			error(400, '操作の指定が正しくありません');
	}
}
