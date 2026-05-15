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

	let body;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const { stallId, rating, comment } = body;
	if (!stallId) throw error(400, 'stallId is required');

	const ratingNum = Number(rating);
	if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
		throw error(400, 'rating は 1〜5 の整数で入力してください');
	}

	// この屋台の完了済み予約があるか確認
	const { count, error: checkErr } = await supabase
		.from('reservations')
		.select('id', { count: 'exact', head: true })
		.eq('user_id', user.id)
		.eq('stall_id', stallId)
		.eq('status', 'completed');

	if (checkErr) throw error(500, '利用実績の確認に失敗しました');
	if ((count ?? 0) < 1) throw error(403, 'この屋台の利用実績がありません');

	// レビューをアップサート（1ユーザー1屋台1レビュー）
	const { error: upsertErr } = await supabase
		.from('stall_reviews')
		.upsert(
			{
				user_id: user.id,
				stall_id: stallId,
				rating: ratingNum,
				comment: comment?.trim() || null
			},
			{ onConflict: 'user_id,stall_id' }
		);

	if (upsertErr) throw error(500, 'レビューの投稿に失敗しました');

	return json({ ok: true });
}
