import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

const RETURN_BONUS = 5;

// 屋台の営業を1回完了（返却）したら信用スコア +5（二重付与防止）
export async function POST({ request }) {
	const authHeader = request.headers.get('Authorization') ?? '';
	const token = authHeader.replace('Bearer ', '').trim();
	if (!token) throw error(401, 'Unauthorized');

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
	if (authErr || !user) throw error(401, 'Unauthorized');

	const { reservationId } = await request.json().catch(() => ({}));
	if (!reservationId) throw error(400, 'reservationId is required');

	const { data: res } = await supabase
		.from('reservations')
		.select('id, user_id, status, return_credit_awarded')
		.eq('id', reservationId)
		.single();

	if (!res) throw error(404, '予約が見つかりません');
	if (res.user_id !== user.id) throw error(403, 'Forbidden');
	if (res.status !== 'completed') return json({ awarded: false, reason: 'not_completed' });
	if (res.return_credit_awarded) return json({ awarded: false, reason: 'already' });

	// 原子的にフラグを立てる（競合時は片方だけ成功）
	const { data: flagged } = await supabase
		.from('reservations')
		.update({ return_credit_awarded: true })
		.eq('id', reservationId)
		.eq('return_credit_awarded', false)
		.select('id');

	if (!flagged?.length) return json({ awarded: false, reason: 'already' });

	// スコア加算
	const { data: prof } = await supabase
		.from('user_profiles')
		.select('credit_score')
		.eq('user_id', user.id)
		.single();
	const newScore = (prof?.credit_score ?? 100) + RETURN_BONUS;
	await supabase.from('user_profiles').update({ credit_score: newScore }).eq('user_id', user.id);

	return json({ awarded: true, bonus: RETURN_BONUS, newScore });
}
