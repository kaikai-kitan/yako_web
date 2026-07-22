import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

function rolesFor(p) {
	if (!p) return ['流浪人'];
	const roles = [];
	if (p.is_shop_operator || p.user_type === '屋台営業者') roles.push('屋台営業者');
	if (p.is_yatai_owner || p.user_type === '屋台提供者') roles.push('屋台オーナー');
	if (p.is_land_owner || p.user_type === '土地オーナー') roles.push('土地オーナー');
	if (roles.length === 0) roles.push('流浪人');
	return roles;
}

// グループのネットワーク図（メンバーをノード、メンバー同士の縁のみをリンク）
export async function GET({ params, request, setHeaders }) {
	const authHeader = request.headers.get('Authorization') ?? '';
	const token = authHeader.replace('Bearer ', '').trim();
	if (!token) throw error(401, 'ログインが必要です');

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
	if (authErr || !user) throw error(401, 'ログインが必要です');

	const { data: group } = await supabase
		.from('yakonin_groups')
		.select('id, owner_id, name, description, starts_at, ends_at, is_closed')
		.eq('id', params.id)
		.maybeSingle();
	if (!group) throw error(404, 'グループが見つかりません');

	// メンバー一覧
	const { data: members } = await supabase
		.from('yakonin_group_members')
		.select('user_id')
		.eq('group_id', group.id);
	const memberIds = (members ?? []).map((m) => m.user_id);
	const memberSet = new Set(memberIds);

	// 閲覧はメンバーのみ
	if (!memberSet.has(user.id)) throw error(403, 'このグループのメンバーのみ閲覧できます');

	// メンバーのプロフィール
	let profiles = [];
	if (memberIds.length > 0) {
		const { data } = await supabase
			.from('user_profiles')
			.select('user_id, name, icon_path, is_shop_operator, is_yatai_owner, is_land_owner, user_type, account_type, ad_active, icon_shape')
			.in('user_id', memberIds);
		profiles = data ?? [];
	}

	// メンバー同士の縁のみ（両端がメンバー）
	let links = [];
	const degree = {};
	if (memberIds.length > 0) {
		const { data: edges } = await supabase
			.from('yakonin_edges')
			.select('user_a, user_b, weight, origin');
		for (const e of edges ?? []) {
			if (memberSet.has(e.user_a) && memberSet.has(e.user_b)) {
				links.push({ source: `u:${e.user_a}`, target: `u:${e.user_b}`, weight: e.weight ?? 1, origin: e.origin ?? 'manual' });
				degree[e.user_a] = (degree[e.user_a] ?? 0) + 1;
				degree[e.user_b] = (degree[e.user_b] ?? 0) + 1;
			}
		}
	}

	const nodes = profiles.map((p) => ({
		id: `u:${p.user_id}`,
		name: p.name || '夜行人',
		img: p.icon_path || '',
		roles: rolesFor(p),
		degree: degree[p.user_id] ?? 0,
		adActive: p.ad_active === true,
		shape: p.icon_shape || 'circle',
		isOwner: p.user_id === group.owner_id,
		type: 'person'
	}));

	setHeaders({ 'cache-control': 'private, max-age=15' });
	return json({
		group: { id: group.id, name: group.name, description: group.description, starts_at: group.starts_at, ends_at: group.ends_at, is_owner: group.owner_id === user.id, member_count: memberIds.length },
		nodes,
		links
	});
}
