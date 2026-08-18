import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

// 屋台の公開詳細（能力・貸出中の借主・過去利用者5件）。PIIは出さず、公開夜行人のみ。
export async function GET({ params, setHeaders }) {
	if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
		return json({ capabilities: null, rentedBy: null, pastUsers: [] });
	}
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const stallId = params.id;

	// 能力フラグ（v23未適用でもフォールバック）
	let capabilities = null;
	// 使用可能用途ラベル（v24。屋台貸し出し人が設定）
	let useCases = [];
	{
		const r = await supabase
			.from('stall_specs')
			.select('can_cook_onsite, can_retail, can_workshop, use_cases')
			.eq('id', stallId)
			.maybeSingle();
		if (!r.error && r.data) {
			capabilities = { cook: r.data.can_cook_onsite === true, retail: r.data.can_retail === true, workshop: r.data.can_workshop === true };
			if (Array.isArray(r.data.use_cases)) useCases = r.data.use_cases;
		} else {
			// v24 未適用（use_cases 列なし）でも can_* から最低限フォールバック
			const r2 = await supabase
				.from('stall_specs')
				.select('can_cook_onsite, can_retail, can_workshop')
				.eq('id', stallId)
				.maybeSingle();
			if (!r2.error && r2.data) {
				capabilities = { cook: r2.data.can_cook_onsite === true, retail: r2.data.can_retail === true, workshop: r2.data.can_workshop === true };
			}
		}
	}

	// 貸出中判定（active な予約があれば借主の店を返す）
	let rentedBy = null;
	{
		// selected_use_cases は v24 未適用だと列が無いためフォールバックで2段構え
		let active = null;
		{
			const q = await supabase
				.from('reservations')
				.select('user_id, planned_items, start_datetime, end_datetime, selected_use_cases')
				.eq('stall_id', stallId)
				.eq('status', 'active')
				.order('start_datetime', { ascending: false })
				.limit(1);
			if (!q.error) active = q.data;
			else {
				const q2 = await supabase
					.from('reservations')
					.select('user_id, planned_items, start_datetime, end_datetime')
					.eq('stall_id', stallId)
					.eq('status', 'active')
					.order('start_datetime', { ascending: false })
					.limit(1);
				active = q2.data;
			}
		}
		const res = active?.[0];
		if (res?.user_id) {
			const [{ data: op }, { data: up }] = await Promise.all([
				supabase.from('operators').select('business_name').eq('user_id', res.user_id).maybeSingle(),
				supabase.from('user_profiles').select('name, icon_path, bio').eq('user_id', res.user_id).maybeSingle()
			]);
			rentedBy = {
				name: op?.business_name || up?.name || '出店者',
				image: up?.icon_path || null,
				bio: up?.bio || '',
				items: summarizeItems(res.planned_items),
				menu: menuFromItems(res.planned_items),
				useCases: Array.isArray(res.selected_use_cases) ? res.selected_use_cases : [],
				until: res.end_datetime || null
			};
		}
	}

	// 過去利用者（完了予約）→ 公開夜行人のハンドル＋アバターを最大5件
	let pastUsers = [];
	{
		const { data: done } = await supabase
			.from('reservations')
			.select('user_id, created_at')
			.eq('stall_id', stallId)
			.eq('status', 'completed')
			.order('created_at', { ascending: false })
			.limit(30);
		const seen = new Set();
		const orderedIds = [];
		for (const r of done ?? []) {
			if (r.user_id && !seen.has(r.user_id)) { seen.add(r.user_id); orderedIds.push(r.user_id); }
		}
		if (orderedIds.length > 0) {
			const { data: profs } = await supabase
				.from('yakonin_profiles')
				.select('user_id, handle, avatar_path')
				.in('user_id', orderedIds)
				.eq('is_public', true);
			const byId = Object.fromEntries((profs ?? []).map((p) => [p.user_id, p]));
			for (const uid of orderedIds) {
				const p = byId[uid];
				if (p) pastUsers.push({ handle: p.handle || '夜行人', avatar: p.avatar_path || '' });
				if (pastUsers.length >= 5) break;
			}
		}
	}

	setHeaders({ 'cache-control': 'public, max-age=20' });
	return json({ capabilities, useCases, rentedBy, pastUsers });
}

// planned_items（JSON配列 or 文字列配列）→ 名前だけの短い配列
function summarizeItems(items) {
	try {
		const arr = typeof items === 'string' ? JSON.parse(items) : items;
		if (!Array.isArray(arr)) return [];
		return arr.map((i) => (typeof i === 'string' ? i : i?.name)).filter(Boolean).slice(0, 6);
	} catch {
		return [];
	}
}

// planned_items → 表示用メニュー配列（name / price / photo）
function menuFromItems(items) {
	try {
		const arr = typeof items === 'string' ? JSON.parse(items) : items;
		if (!Array.isArray(arr)) return [];
		return arr
			.map((i) => (typeof i === 'string'
				? { name: i, price: 0, photo: '' }
				: { name: i?.name ?? '', price: Number(i?.price) || 0, photo: i?.photoUrl || i?.photo || '' }))
			.filter((i) => i.name)
			.slice(0, 12);
	} catch {
		return [];
	}
}
