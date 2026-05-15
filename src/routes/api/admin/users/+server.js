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

	const { data: profiles, error: err } = await supabase
		.from('user_profiles')
		.select('user_id, name, credit_score, is_suspended, created_at')
		.order('is_suspended', { ascending: false })
		.order('credit_score', { ascending: true });

	if (err) throw error(500, err.message);

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

	throw error(400, 'unknown action');
}
