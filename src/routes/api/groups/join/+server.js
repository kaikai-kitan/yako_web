import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { logAudit, isGroupClosed } from '$lib/server/groups.js';

export const prerender = false;

// 招待コードでグループに参加。承認制なら「参加申請（pending）」、即参加なら即メンバー（active）。
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
		.select('id, name, join_policy, ends_at, is_closed')
		.eq('join_code', joinCode)
		.maybeSingle();
	if (!group) throw error(404, 'グループが見つかりません。コードをご確認ください');

	if (isGroupClosed(group)) throw error(400, 'このグループは受付を終了しています');

	// 既存のメンバーシップを確認
	const { data: existing } = await supabase
		.from('yakonin_group_members')
		.select('status')
		.eq('group_id', group.id)
		.eq('user_id', user.id)
		.maybeSingle();

	if (existing) {
		return json({ ok: true, groupId: group.id, name: group.name, status: existing.status, alreadyMember: true });
	}

	// 承認制なら pending、即参加なら active
	const status = group.join_policy === 'open' ? 'active' : 'pending';
	const { error: insErr } = await supabase
		.from('yakonin_group_members')
		.insert({ group_id: group.id, user_id: user.id, role: 'member', status });
	if (insErr && insErr.code !== '23505') throw error(500, insErr.message);

	await logAudit(supabase, {
		groupId: group.id, actorId: user.id,
		action: status === 'active' ? 'join' : 'join_request'
	});

	return json({ ok: true, groupId: group.id, name: group.name, status });
}
