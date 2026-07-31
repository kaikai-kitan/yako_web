import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { getGroupContext, isManager } from '$lib/server/groups.js';

export const prerender = false;

// グループのメンバー・参加申請の一覧（管理者=owner/sub_admin のみ）
export async function GET({ params, request }) {
	const authHeader = request.headers.get('Authorization') ?? '';
	const token = authHeader.replace('Bearer ', '').trim();
	if (!token) throw error(401, 'ログインが必要です');

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
	if (authErr || !user) throw error(401, 'ログインが必要です');

	const { group, membership } = await getGroupContext(supabase, params.id, user.id);
	if (!group) throw error(404, 'グループが見つかりません');
	if (!membership || !isManager(membership.role)) throw error(403, '管理権限がありません');

	const { data: rows } = await supabase
		.from('yakonin_group_members')
		.select('user_id, role, status, joined_at')
		.eq('group_id', group.id);

	const ids = (rows ?? []).map((r) => r.user_id);
	let profiles = {};
	if (ids.length > 0) {
		const { data: ups } = await supabase
			.from('user_profiles')
			.select('user_id, name, icon_path')
			.in('user_id', ids);
		for (const p of ups ?? []) profiles[p.user_id] = p;
	}

	const decorate = (r) => ({
		user_id: r.user_id,
		role: r.role,
		status: r.status,
		joined_at: r.joined_at,
		name: profiles[r.user_id]?.name || '夜行人',
		icon_path: profiles[r.user_id]?.icon_path || ''
	});

	const members = (rows ?? []).filter((r) => r.status === 'active').map(decorate);
	const pending = (rows ?? []).filter((r) => r.status === 'pending').map(decorate);

	return json({
		group: { id: group.id, name: group.name, join_policy: group.join_policy, is_owner: group.owner_id === user.id, my_role: membership.role },
		members,
		pending
	});
}
