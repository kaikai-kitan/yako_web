import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

// 有料プラン契約者か（現状は法人サブスク。将来の個人有料プランも subscription_status で自動対象）
function isPaid(profile) {
	return profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';
}

// 紛らわしい文字を除いた8桁の招待コード
function genCode() {
	const alph = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let s = '';
	for (let i = 0; i < 8; i++) s += alph[Math.floor(Math.random() * alph.length)];
	return s;
}

export async function POST({ request }) {
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
	if (!isPaid(profile)) throw error(403, 'グループの作成は有料プランのご契約者のみご利用いただけます');

	const body = await request.json().catch(() => ({}));
	const name = (body.name ?? '').trim().slice(0, 40);
	if (!name) throw error(400, 'グループ名を入力してください');
	const description = (body.description ?? '').trim().slice(0, 200) || null;
	const startsAt = body.startsAt || null;
	const endsAt = body.endsAt || null;

	// 一意なコードを最大5回リトライ
	let group = null;
	for (let attempt = 0; attempt < 5; attempt++) {
		const join_code = genCode();
		const { data, error: insErr } = await supabase
			.from('yakonin_groups')
			.insert({ owner_id: user.id, name, description, join_code, starts_at: startsAt, ends_at: endsAt })
			.select()
			.single();
		if (!insErr) { group = data; break; }
		if (insErr.code !== '23505') throw error(500, insErr.message); // 23505=unique違反ならコード再生成
	}
	if (!group) throw error(500, 'グループの作成に失敗しました');

	// 作成者を自動でメンバーに追加
	await supabase.from('yakonin_group_members').insert({ group_id: group.id, user_id: user.id });

	return json({ group });
}
