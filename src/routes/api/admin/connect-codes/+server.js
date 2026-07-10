import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

function requireAdmin(cookies) {
	const token = cookies.get('admin_session');
	if (!token || token !== env.ADMIN_SECRET) throw error(403, 'Forbidden');
}

// 夜行人の接続コード一覧（NFCカード書き込み・管理用）
export async function GET({ cookies }) {
	requireAdmin(cookies);

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

	const { data: profiles, error: err } = await supabase
		.from('yakonin_profiles')
		.select('user_id, handle, connect_code, is_public, created_at')
		.order('created_at', { ascending: false });
	if (err) throw error(500, err.message);

	// 本名（user_profiles.name）を突き合わせて管理しやすく
	const uids = (profiles ?? []).map((p) => p.user_id);
	let nameByUid = new Map();
	if (uids.length) {
		const { data: users } = await supabase
			.from('user_profiles')
			.select('user_id, name')
			.in('user_id', uids);
		nameByUid = new Map((users ?? []).map((u) => [u.user_id, u.name]));
	}

	const codes = (profiles ?? []).map((p) => ({
		user_id: p.user_id,
		name: nameByUid.get(p.user_id) ?? '',
		handle: p.handle ?? '',
		connect_code: p.connect_code ?? '',
		is_public: p.is_public,
		created_at: p.created_at
	}));

	return json({ codes });
}
