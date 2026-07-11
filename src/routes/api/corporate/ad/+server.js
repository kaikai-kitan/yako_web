import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

// URL の軽いバリデーション（http/https のみ許可。空はnull）
function cleanUrl(v) {
	const s = (v ?? '').trim();
	if (!s) return null;
	try {
		const u = new URL(s);
		if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
		return u.toString();
	} catch {
		return null;
	}
}

// 法人広告の内容を保存（承認済みの法人アカウントのみ）
export async function POST({ request }) {
	const authHeader = request.headers.get('Authorization') ?? '';
	const token = authHeader.replace('Bearer ', '').trim();
	if (!token) throw error(401, 'ログインが必要です');

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
	if (authErr || !user) throw error(401, 'ログインが必要です');

	const { data: profile } = await supabase
		.from('user_profiles')
		.select('account_type, corp_status')
		.eq('user_id', user.id)
		.maybeSingle();
	if (!profile || profile.account_type !== 'corporate' || profile.corp_status !== 'approved') {
		throw error(403, '法人アカウントの承認後に広告を編集できます');
	}

	const body = await request.json().catch(() => ({}));
	const headline = (body.headline ?? '').trim().slice(0, 60);
	const storeUrl = cleanUrl(body.storeUrl);
	const recruitUrl = cleanUrl(body.recruitUrl);
	const imagePath = (body.imagePath ?? '').trim() || null;

	const { error: upErr } = await supabase
		.from('user_profiles')
		.update({
			ad_headline: headline || null,
			ad_store_url: storeUrl,
			ad_recruit_url: recruitUrl,
			ad_image_path: imagePath
		})
		.eq('user_id', user.id);
	if (upErr) throw error(500, upErr.message);

	return json({ ok: true });
}
