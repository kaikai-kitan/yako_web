import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

function isPaid(profile) {
	return profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';
}

// ログイン中ユーザーの「作成したグループ」「参加中のグループ」を返す
export async function GET({ request }) {
	const authHeader = request.headers.get('Authorization') ?? '';
	const token = authHeader.replace('Bearer ', '').trim();
	if (!token) throw error(401, 'ログインが必要です');

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
	if (authErr || !user) throw error(401, 'ログインが必要です');

	const { data: profile } = await supabase
		.from('user_profiles')
		.select('subscription_status')
		.eq('user_id', user.id)
		.maybeSingle();

	// 参加中グループのID
	const { data: memberships } = await supabase
		.from('yakonin_group_members')
		.select('group_id')
		.eq('user_id', user.id);
	const joinedIds = (memberships ?? []).map((m) => m.group_id);

	let groups = [];
	if (joinedIds.length > 0) {
		const { data } = await supabase
			.from('yakonin_groups')
			.select('id, owner_id, name, description, join_code, starts_at, ends_at, is_closed, created_at')
			.in('id', joinedIds)
			.order('created_at', { ascending: false });
		groups = data ?? [];
	}

	// メンバー数をまとめて取得
	const counts = {};
	if (joinedIds.length > 0) {
		const { data: mem } = await supabase
			.from('yakonin_group_members')
			.select('group_id')
			.in('group_id', joinedIds);
		for (const m of mem ?? []) counts[m.group_id] = (counts[m.group_id] ?? 0) + 1;
	}

	const result = groups.map((g) => ({
		...g,
		member_count: counts[g.id] ?? 0,
		is_owner: g.owner_id === user.id,
		// 招待コードは作成者にのみ返す
		join_code: g.owner_id === user.id ? g.join_code : undefined
	}));

	return json({ groups: result, canCreate: isPaid(profile) });
}
