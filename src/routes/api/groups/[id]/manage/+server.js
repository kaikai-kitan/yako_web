import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { getGroupContext, isOwner, isManager, logAudit } from '$lib/server/groups.js';

export const prerender = false;

// グループの管理操作（承認/拒否/削除/ロール付与/編集/クローズ）。
// 権限はグループ単位・ロール単位で判定（fail-closed）し、すべて監査ログに残す。
export async function POST({ params, request }) {
	const authHeader = request.headers.get('Authorization') ?? '';
	const token = authHeader.replace('Bearer ', '').trim();
	if (!token) throw error(401, 'ログインが必要です');

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
	if (authErr || !user) throw error(401, 'ログインが必要です');

	const { group, membership } = await getGroupContext(supabase, params.id, user.id);
	if (!group) throw error(404, 'グループが見つかりません');
	// 管理者（owner/sub_admin）でなければ即拒否（fail-closed）
	if (!membership || membership.status !== 'active' || !isManager(membership.role)) {
		throw error(403, '管理権限がありません');
	}

	const body = await request.json().catch(() => ({}));
	const action = body.action;
	const groupId = group.id;

	// 対象メンバーの現在のロール/状態を取得するヘルパー
	async function targetMember(uid) {
		const { data } = await supabase
			.from('yakonin_group_members')
			.select('role, status')
			.eq('group_id', groupId).eq('user_id', uid).maybeSingle();
		return data ?? null;
	}

	switch (action) {
		case 'approve': {
			const uid = body.targetUserId;
			const t = uid && await targetMember(uid);
			if (!t || t.status !== 'pending') throw error(400, '承認できる申請が見つかりません');
			await supabase.from('yakonin_group_members').update({ status: 'active' }).eq('group_id', groupId).eq('user_id', uid);
			await logAudit(supabase, { groupId, actorId: user.id, action: 'approve', targetUserId: uid });
			return json({ ok: true });
		}
		case 'reject': {
			const uid = body.targetUserId;
			const t = uid && await targetMember(uid);
			if (!t || t.status !== 'pending') throw error(400, '対象の申請が見つかりません');
			await supabase.from('yakonin_group_members').delete().eq('group_id', groupId).eq('user_id', uid);
			await logAudit(supabase, { groupId, actorId: user.id, action: 'reject', targetUserId: uid });
			return json({ ok: true });
		}
		case 'remove': {
			const uid = body.targetUserId;
			if (uid === user.id) throw error(400, '自分自身は削除できません');
			const t = uid && await targetMember(uid);
			if (!t) throw error(404, 'メンバーが見つかりません');
			if (t.role === 'owner') throw error(403, 'オーナーは削除できません');
			// sub_admin は他の sub_admin を削除できない（owner のみ）
			if (t.role === 'sub_admin' && !isOwner(membership.role)) throw error(403, 'サブ管理者を外せるのはオーナーのみです');
			await supabase.from('yakonin_group_members').delete().eq('group_id', groupId).eq('user_id', uid);
			await logAudit(supabase, { groupId, actorId: user.id, action: 'remove', targetUserId: uid, detail: { role: t.role } });
			return json({ ok: true });
		}
		case 'grant_admin':
		case 'revoke_admin': {
			// ロールの変更は owner のみ
			if (!isOwner(membership.role)) throw error(403, 'ロールの変更はオーナーのみ可能です');
			const uid = body.targetUserId;
			const t = uid && await targetMember(uid);
			if (!t || t.status !== 'active') throw error(400, '対象の正式メンバーが見つかりません');
			if (t.role === 'owner') throw error(400, 'オーナーのロールは変更できません');
			const newRole = action === 'grant_admin' ? 'sub_admin' : 'member';
			await supabase.from('yakonin_group_members').update({ role: newRole }).eq('group_id', groupId).eq('user_id', uid);
			await logAudit(supabase, { groupId, actorId: user.id, action, targetUserId: uid });
			return json({ ok: true, role: newRole });
		}
		case 'edit': {
			// 名前・説明・期間の編集は管理者（owner/sub_admin）
			const patch = {};
			if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim().slice(0, 40);
			if (typeof body.description === 'string') patch.description = body.description.trim().slice(0, 200) || null;
			if ('startsAt' in body) patch.starts_at = body.startsAt || null;
			if ('endsAt' in body) patch.ends_at = body.endsAt || null;
			if (body.joinPolicy === 'open' || body.joinPolicy === 'approval') patch.join_policy = body.joinPolicy;
			if (Object.keys(patch).length === 0) throw error(400, '変更内容がありません');
			await supabase.from('yakonin_groups').update(patch).eq('id', groupId);
			await logAudit(supabase, { groupId, actorId: user.id, action: 'edit', detail: patch });
			return json({ ok: true });
		}
		case 'close':
		case 'reopen': {
			// クローズ/再開は owner のみ
			if (!isOwner(membership.role)) throw error(403, '受付の開閉はオーナーのみ可能です');
			await supabase.from('yakonin_groups').update({ is_closed: action === 'close' }).eq('id', groupId);
			await logAudit(supabase, { groupId, actorId: user.id, action });
			return json({ ok: true });
		}
		default:
			throw error(400, '不明な操作です');
	}
}
