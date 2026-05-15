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

	const { data: applications, error: appErr } = await supabase
		.from('operators')
		.select('user_id, business_name, applied_at, rejection_reason, shop_application_status, user_profiles(name)')
		.eq('shop_application_status', 'pending')
		.order('applied_at', { ascending: true });

	if (appErr) throw error(500, '申請一覧の取得に失敗しました');

	// 各申請者の出店実績数・レビュー平均を並行取得
	const enriched = await Promise.all(
		(applications ?? []).map(async (app) => {
			const [rentalsRes, stallsRes] = await Promise.all([
				supabase
					.from('reservations')
					.select('id', { count: 'exact', head: true })
					.eq('user_id', app.user_id)
					.eq('status', 'completed'),
				supabase.from('stall_specs').select('id').eq('user_id', app.user_id)
			]);

			const completedRentals = rentalsRes.count ?? 0;
			const stallIds = (stallsRes.data ?? []).map((s) => s.id);

			let avgRating = null;
			let reviewCount = 0;

			if (stallIds.length > 0) {
				const { data: reviews } = await supabase
					.from('stall_reviews')
					.select('rating')
					.in('stall_id', stallIds);

				reviewCount = reviews?.length ?? 0;
				if (reviewCount > 0) {
					avgRating =
						Math.round(
							(reviews.reduce((s, r) => s + r.rating, 0) / reviewCount) * 10
						) / 10;
				}
			}

			return {
				user_id: app.user_id,
				business_name: app.business_name,
				user_name: app.user_profiles?.name ?? '（名前未設定）',
				applied_at: app.applied_at,
				completed_rentals: completedRentals,
				avg_rating: avgRating,
				review_count: reviewCount
			};
		})
	);

	return json({ applications: enriched });
}

export async function POST({ request, cookies }) {
	requireAdmin(cookies);

	let body;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const { userId, action, reason } = body;
	if (!userId || !action) throw error(400, 'userId と action は必須です');
	if (!['approve', 'reject'].includes(action)) throw error(400, '無効な action です');
	if (action === 'reject' && !reason?.trim()) throw error(400, '却下理由を入力してください');

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

	const { error: updateErr } = await supabase
		.from('operators')
		.update({
			shop_application_status: action === 'approve' ? 'approved' : 'rejected',
			rejection_reason: action === 'reject' ? reason.trim() : null
		})
		.eq('user_id', userId);

	if (updateErr) throw error(500, '更新に失敗しました');

	return json({ ok: true });
}
