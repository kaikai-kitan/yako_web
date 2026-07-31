// イベントグループの権限判定・監査ログの共通ヘルパー（サーバー専用）
//
// ロール: owner（作成者）/ sub_admin（共同運営）/ member
//   - owner    : すべて（編集・削除・クローズ・sub_admin任命・承認/削除）
//   - sub_admin: 参加承認/拒否・メンバー削除・名前/説明/期間の編集
//   - member   : 閲覧のみ
// 判定は fail-closed（該当しなければ拒否）。

export function isOwner(role) {
	return role === 'owner';
}
export function isManager(role) {
	return role === 'owner' || role === 'sub_admin';
}

// グループと、リクエスト元ユーザーのメンバーシップ（role/status）を取得
export async function getGroupContext(supabase, groupId, userId) {
	const { data: group } = await supabase
		.from('yakonin_groups')
		.select('id, owner_id, name, description, join_code, join_policy, starts_at, ends_at, is_closed, created_at')
		.eq('id', groupId)
		.maybeSingle();
	if (!group) return { group: null, membership: null };

	const { data: membership } = await supabase
		.from('yakonin_group_members')
		.select('role, status')
		.eq('group_id', groupId)
		.eq('user_id', userId)
		.maybeSingle();

	return { group, membership: membership ?? null };
}

// 監査ログを1件残す（失敗しても本処理は止めない）
export async function logAudit(supabase, { groupId, actorId, action, targetUserId = null, detail = null }) {
	try {
		await supabase.from('yakonin_group_audit').insert({
			group_id: groupId,
			actor_id: actorId ?? null,
			action,
			target_user_id: targetUserId,
			detail
		});
	} catch (e) {
		console.error('group audit log error:', e);
	}
}

// グループが受付終了しているか（クローズ or 終了日時超過）
export function isGroupClosed(group) {
	return !!group.is_closed || (group.ends_at && new Date(group.ends_at).getTime() < Date.now());
}
