import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

export async function POST({ request }) {
	const authHeader = request.headers.get('authorization') ?? '';
	const token = authHeader.replace('Bearer ', '').trim();
	if (!token) throw error(401, 'Unauthorized');

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

	const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
	if (authErr || !user) throw error(401, 'Unauthorized');

	// オペレーターレコード確認
	const { data: operator, error: opErr } = await supabase
		.from('operators')
		.select('shop_application_status')
		.eq('user_id', user.id)
		.maybeSingle();

	if (opErr || !operator) throw error(400, '屋台主プロフィールが見つかりません。先にプロフィールを作成してください。');

	if (operator.shop_application_status === 'approved') {
		throw error(409, 'すでに承認済みです');
	}
	if (operator.shop_application_status === 'pending') {
		throw error(409, 'すでに審査中です。審査結果をお待ちください。');
	}

	// 屋台出店実績（完了済み予約）を確認
	const { count, error: countErr } = await supabase
		.from('reservations')
		.select('id', { count: 'exact', head: true })
		.eq('user_id', user.id)
		.eq('status', 'completed');

	if (countErr) throw error(500, '出店実績の確認に失敗しました');

	if ((count ?? 0) < 1) {
		throw error(403, 'オンラインショップ開設には屋台での出店実績（1回以上）が必要です');
	}

	// 申請ステータスを pending に更新
	const { error: updateErr } = await supabase
		.from('operators')
		.update({
			shop_application_status: 'pending',
			rejection_reason: null,
			applied_at: new Date().toISOString()
		})
		.eq('user_id', user.id);

	if (updateErr) throw error(500, '申請の送信に失敗しました');

	return json({ ok: true });
}
