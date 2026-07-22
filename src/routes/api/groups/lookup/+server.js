import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

// 招待コードからグループの公開情報を取得（参加前のプレビュー用。会員でなくても可）
export async function GET({ url }) {
	const code = (url.searchParams.get('code') ?? '').trim().toUpperCase();
	if (!code) throw error(400, 'コードがありません');

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const { data: group } = await supabase
		.from('yakonin_groups')
		.select('id, name, description, ends_at, is_closed')
		.eq('join_code', code)
		.maybeSingle();
	if (!group) throw error(404, 'グループが見つかりません');

	const { count } = await supabase
		.from('yakonin_group_members')
		.select('user_id', { count: 'exact', head: true })
		.eq('group_id', group.id);

	const closed = group.is_closed || (group.ends_at && new Date(group.ends_at).getTime() < Date.now());

	return json({
		id: group.id,
		name: group.name,
		description: group.description,
		ends_at: group.ends_at,
		closed: !!closed,
		member_count: count ?? 0
	});
}
