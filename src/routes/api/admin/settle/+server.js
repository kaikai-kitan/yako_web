import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

function isAdmin(userId) {
	const adminIds = (env.ADMIN_USER_IDS ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	return adminIds.includes(userId);
}

export async function POST({ request }) {
	const authHeader = request.headers.get('authorization') ?? '';
	const token = authHeader.replace('Bearer ', '').trim();
	if (!token) throw error(401, 'Unauthorized');

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

	const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
	if (authErr || !user || !isAdmin(user.id)) throw error(403, 'Forbidden');

	let body;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	// orderIds: 精算対象の注文IDリスト
	const { orderIds } = body;
	if (!Array.isArray(orderIds) || orderIds.length === 0) {
		throw error(400, 'orderIds must be a non-empty array');
	}

	const { error: updateErr } = await supabase
		.from('shop_orders')
		.update({
			settlement_status: 'settled',
			settled_at: new Date().toISOString()
		})
		.in('id', orderIds)
		.eq('settlement_status', 'unsettled'); // 二重精算防止

	if (updateErr) throw error(500, updateErr.message);

	return json({ ok: true, settled: orderIds.length });
}
