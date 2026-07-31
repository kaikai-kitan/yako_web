import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

function isPaid(profile) {
	return profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';
}

// ログイン中ユーザーの「参加中／申請中のグループ」を返す
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

	// 自分のメンバーシップ（role/status付き）
	const { data: myMemberships } = await supabase
		.from('yakonin_group_members')
		.select('group_id, role, status')
		.eq('user_id', user.id);
	const myMap = new Map((myMemberships ?? []).map((m) => [m.group_id, m]));
	const groupIds = [...myMap.keys()];

	let groups = [];
	if (groupIds.length > 0) {
		const { data } = await supabase
			.from('yakonin_groups')
			.select('id, owner_id, name, description, join_code, join_policy, starts_at, ends_at, is_closed, created_at')
			.in('id', groupIds)
			.order('created_at', { ascending: false });
		groups = data ?? [];
	}

	// 各グループの active メンバー数と承認待ち数
	const activeCount = {};
	const pendingCount = {};
	if (groupIds.length > 0) {
		const { data: mem } = await supabase
			.from('yakonin_group_members')
			.select('group_id, status')
			.in('group_id', groupIds);
		for (const m of mem ?? []) {
			if (m.status === 'active') activeCount[m.group_id] = (activeCount[m.group_id] ?? 0) + 1;
			else if (m.status === 'pending') pendingCount[m.group_id] = (pendingCount[m.group_id] ?? 0) + 1;
		}
	}

	const result = groups.map((g) => {
		const mine = myMap.get(g.id) ?? {};
		const isManager = mine.role === 'owner' || mine.role === 'sub_admin';
		return {
			id: g.id,
			name: g.name,
			description: g.description,
			join_policy: g.join_policy,
			starts_at: g.starts_at,
			ends_at: g.ends_at,
			is_closed: g.is_closed,
			member_count: activeCount[g.id] ?? 0,
			my_role: mine.role ?? 'member',
			my_status: mine.status ?? 'active',
			is_owner: g.owner_id === user.id,
			// 招待コード・承認待ち数は管理者のみ
			join_code: isManager ? g.join_code : undefined,
			pending_count: isManager ? (pendingCount[g.id] ?? 0) : undefined
		};
	});

	return json({ groups: result, canCreate: isPaid(profile) });
}
