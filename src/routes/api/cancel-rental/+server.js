import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

export const prerender = false;

function calcPenalty(startDatetime) {
	const now = new Date();
	const start = new Date(startDatetime);

	const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
	const diffDays = Math.round((startDay - nowDay) / (1000 * 60 * 60 * 24));

	if (diffDays <= 0) return 3;   // 当日
	if (diffDays === 1) return 2;  // 前日
	if (diffDays === 2) return 1;  // 前々日
	return 0;                      // 3日以上前
}

export async function POST({ request, cookies }) {
	const authHeader = request.headers.get('Authorization') ?? '';
	const token = authHeader.replace('Bearer ', '').trim();
	if (!token) throw error(401, 'Unauthorized');

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

	const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
	if (authErr || !user) throw error(401, 'Unauthorized');

	const body = await request.json().catch(() => ({}));
	const { reservationId } = body;
	if (!reservationId) throw error(400, 'reservationId is required');

	// 予約を取得して所有者確認
	const { data: reservation, error: resErr } = await supabase
		.from('reservations')
		.select('id, user_id, status, start_datetime')
		.eq('id', reservationId)
		.single();

	if (resErr || !reservation) throw error(404, '予約が見つかりません');
	if (reservation.user_id !== user.id) throw error(403, 'Forbidden');
	if (reservation.status === 'cancelled' || reservation.status === 'completed') {
		throw error(400, 'この予約はキャンセルできません');
	}

	const penalty = calcPenalty(reservation.start_datetime);

	// キャンセル処理（トランザクション的にサービスロールで実行）
	const { error: cancelErr } = await supabase
		.from('reservations')
		.update({ status: 'cancelled' })
		.eq('id', reservationId);

	if (cancelErr) throw error(500, 'キャンセルに失敗しました');

	if (penalty > 0) {
		// credit_score を減算してアカウント停止を判定
		const { data: profile, error: profileErr } = await supabase
			.from('user_profiles')
			.select('credit_score')
			.eq('user_id', user.id)
			.single();

		if (!profileErr && profile) {
			const newScore = Math.max(0, (profile.credit_score ?? 300) - penalty);
			const isSuspended = newScore <= 0;
			await supabase
				.from('user_profiles')
				.update({ credit_score: newScore, is_suspended: isSuspended })
				.eq('user_id', user.id);

			return json({ ok: true, penalty, newScore, isSuspended });
		}
	}

	return json({ ok: true, penalty, newScore: null, isSuspended: false });
}
