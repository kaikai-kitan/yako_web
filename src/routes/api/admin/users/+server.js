import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

function requireAdmin(cookies) {
	const token = cookies.get('admin_session');
	if (!token || token !== env.ADMIN_SECRET) throw error(403, 'Forbidden');
}

export async function GET({ cookies }) {
	requireAdmin(cookies);

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

	// account_type / ad_active は migration v18 で追加。未適用でも動くようフォールバック
	let profiles = null;
	const r = await supabase
		.from('user_profiles')
		.select('user_id, name, credit_score, is_suspended, created_at, account_type, ad_active, corp_status')
		.order('is_suspended', { ascending: false })
		.order('credit_score', { ascending: true });
	if (r.error && (r.error.code === '42703' || /account_type|ad_active|corp_status/.test(r.error.message ?? ''))) {
		const r2 = await supabase
			.from('user_profiles')
			.select('user_id, name, credit_score, is_suspended, created_at')
			.order('is_suspended', { ascending: false })
			.order('credit_score', { ascending: true });
		if (r2.error) throw error(500, r2.error.message);
		profiles = r2.data;
	} else if (r.error) {
		throw error(500, r.error.message);
	} else {
		profiles = r.data;
	}

	return json({ users: profiles ?? [] });
}

export async function POST({ request, cookies }) {
	requireAdmin(cookies);

	const body = await request.json().catch(() => ({}));
	const { userId, action } = body;
	if (!userId || !action) throw error(400, 'userId and action are required');

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

	if (action === 'reset_score') {
		const { error: err } = await supabase
			.from('user_profiles')
			.update({ credit_score: 300, is_suspended: false })
			.eq('user_id', userId);
		if (err) throw error(500, err.message);
		return json({ ok: true });
	}

	if (action === 'unsuspend') {
		const { error: err } = await supabase
			.from('user_profiles')
			.update({ is_suspended: false })
			.eq('user_id', userId);
		if (err) throw error(500, err.message);
		return json({ ok: true });
	}

	// 法人アカウントを有効化（承認＋広告表示ON）。※テスト有効化にも使用
	if (action === 'enable_corporate') {
		const { error: err } = await supabase
			.from('user_profiles')
			.update({ account_type: 'corporate', corp_status: 'approved', ad_active: true })
			.eq('user_id', userId);
		if (err) throw error(500, err.message);
		return json({ ok: true });
	}

	// 法人を解除（一般アカウントへ・広告表示OFF）
	if (action === 'disable_corporate') {
		const { error: err } = await supabase
			.from('user_profiles')
			.update({ account_type: 'individual', corp_status: 'none', ad_active: false })
			.eq('user_id', userId);
		if (err) throw error(500, err.message);
		return json({ ok: true });
	}

	throw error(400, 'unknown action');
}
