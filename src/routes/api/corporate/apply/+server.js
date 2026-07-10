import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

// 法人アカウントの申請（審査待ちにする）
export async function POST({ request }) {
	const authHeader = request.headers.get('Authorization') ?? '';
	const token = authHeader.replace('Bearer ', '').trim();
	if (!token) throw error(401, 'ログインが必要です');

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
	if (authErr || !user) throw error(401, 'ログインが必要です');

	const { corpName } = await request.json().catch(() => ({}));
	if (!corpName || !corpName.trim()) throw error(400, '法人名（屋号）を入力してください');

	const { error: upErr } = await supabase
		.from('user_profiles')
		.update({ corp_name: corpName.trim(), corp_status: 'pending' })
		.eq('user_id', user.id);
	if (upErr) throw error(500, upErr.message);

	return json({ ok: true });
}
