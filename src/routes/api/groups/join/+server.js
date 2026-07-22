import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

// 招待コードでグループに参加（無課金の人も参加可）
export async function POST({ request }) {
	const authHeader = request.headers.get('Authorization') ?? '';
	const token = authHeader.replace('Bearer ', '').trim();
	if (!token) throw error(401, 'ログインが必要です');

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
	if (authErr || !user) throw error(401, 'ログインが必要です');

	const { code } = await request.json().catch(() => ({}));
	const joinCode = (code ?? '').trim().toUpperCase();
	if (!joinCode) throw error(400, '招待コードを入力してください');

	const { data: group } = await supabase
		.from('yakonin_groups')
		.select('id, name, ends_at, is_closed')
		.eq('join_code', joinCode)
		.maybeSingle();
	if (!group) throw error(404, 'グループが見つかりません。コードをご確認ください');

	// 締切/クローズ判定
	const closed = group.is_closed || (group.ends_at && new Date(group.ends_at).getTime() < Date.now());
	if (closed) throw error(400, 'このグループは受付を終了しています');

	// 既に参加済みなら成功として扱う
	const { data: existing } = await supabase
		.from('yakonin_group_members')
		.select('user_id')
		.eq('group_id', group.id)
		.eq('user_id', user.id)
		.maybeSingle();
	if (!existing) {
		const { error: insErr } = await supabase
			.from('yakonin_group_members')
			.insert({ group_id: group.id, user_id: user.id });
		if (insErr && insErr.code !== '23505') throw error(500, insErr.message);
	}

	return json({ ok: true, groupId: group.id, name: group.name, alreadyMember: !!existing });
}
