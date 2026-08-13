import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

function assertAdmin(cookies) {
	const token = cookies.get('admin_session');
	if (!token || token !== env.ADMIN_SECRET) throw error(403, 'Forbidden');
}

// 屋台一覧＋能力フラグ
export async function GET({ cookies }) {
	assertAdmin(cookies);
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const { data, error: e } = await supabase
		.from('stall_specs')
		.select('id, stall_name, can_cook_onsite, can_retail, can_workshop, operators ( business_name )')
		.order('created_at', { ascending: false });
	if (e) {
		// v23未適用（能力カラム無し）でも名前だけ返す
		if (e.code === '42703') {
			const r2 = await supabase.from('stall_specs').select('id, stall_name, operators ( business_name )').order('created_at', { ascending: false });
			return json({ stalls: (r2.data ?? []).map((s) => ({ ...s, can_cook_onsite: false, can_retail: false, can_workshop: false })), migrated: false });
		}
		throw error(500, e.message);
	}
	return json({ stalls: data ?? [], migrated: true });
}

// 能力フラグの更新
export async function POST({ request, cookies }) {
	assertAdmin(cookies);
	const { id, can_cook_onsite, can_retail, can_workshop } = await request.json().catch(() => ({}));
	if (!id) throw error(400, 'id がありません');
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const { error: e } = await supabase
		.from('stall_specs')
		.update({ can_cook_onsite: !!can_cook_onsite, can_retail: !!can_retail, can_workshop: !!can_workshop })
		.eq('id', id);
	if (e) throw error(500, e.message);
	return json({ ok: true });
}
